import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { EnvironmentValidationService } from './shared/infrastructure/environment/environment-validation.service';
import { PreflightModule } from './shared/infrastructure/environment/preflight.module';
import { StructuredLoggerService } from './shared/infrastructure/observability/structured-logger.service';
import { RequestContextUserInterceptor } from './shared/infrastructure/observability/request-context-user.interceptor';
import { RequestContextService } from './shared/infrastructure/observability/request-context.service';

/**
 * M31 Phase 7 — real, fail-closed startup validation, run in a lightweight, throwaway application
 * CONTEXT (not the full HTTP app; `PreflightModule` loads only `ConfigModule`) — deliberately
 * BEFORE `NestFactory.create(AppModule, ...)` is ever called. Self-caught ordering bug: an earlier
 * version of this validation ran AFTER `NestFactory.create()`, which already instantiates every
 * provider in the whole module tree — several providers (`JwtStrategy` among them) throw their OWN
 * raw, unhelpful error the moment a required secret is missing (`JwtStrategy requires a secret or
 * key`, with no indication of WHICH env var to fix or whether anything else is also wrong), so
 * `EnvironmentValidationService`'s clear, itemized report never got a chance to run at all —
 * reproduced live (a deliberately-missing `JWT_ACCESS_SECRET` crashed during `NestFactory.create()`
 * with exactly that raw message, before this fix). Running the SAME validation rules against a
 * minimal `ConfigModule`-only context first means the operator always sees the itemized report,
 * regardless of what any downstream provider's constructor might additionally do.
 */
async function validateEnvironmentOrExit(): Promise<void> {
  const context = await NestFactory.createApplicationContext(PreflightModule, { logger: ['error', 'warn', 'log'] });
  try {
    context.get(EnvironmentValidationService).validateOrThrow(context.get(ConfigService));
  } finally {
    await context.close();
  }
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  await validateEnvironmentOrExit();

  // rawBody: true preserves the exact request bytes on req.rawBody for every request (alongside
  // the normal parsed req.body) — needed by the Paddle webhook endpoint, whose signature
  // verification is byte-exact (M27 Phase 5). Nothing else in the app reads req.rawBody.
  // bufferLogs: true — the standard Nest pattern for a custom logger: buffers every log Nest's
  // own bootstrap process emits (module initialization, route mapping) until `useLogger()` below
  // actually runs, so those lines go through the real structured logger too instead of printing
  // via the default ConsoleLogger first and only switching over afterward.
  const app = await NestFactory.create(AppModule, { rawBody: true, bodyParser: true, bufferLogs: true });

  // M31 Phase 15 — real structured (JSON) logging, replacing the placeholder `LoggerModule` (Phase
  // 1 audit finding). Verified (by reading @nestjs/common's own compiled source, not assumed) that
  // this redirects EVERY existing `new Logger(SomeClass.name)` call site across the entire
  // application automatically — see `StructuredLoggerService`'s own doc comment for why.
  app.useLogger(app.get(StructuredLoggerService));

  const configService = app.get(ConfigService);
  const environment = configService.get<string>('app.environment', 'development');
  const isProduction = environment === 'production';

  // M31 Phase 4/16 — without this, every `OnModuleDestroy` hook in this codebase (all 6 tick-driver
  // services' interval cleanup, `PrismaService.onModuleDestroy()`) is dead code on a real SIGTERM —
  // Nest only invokes lifecycle shutdown hooks when this is explicitly enabled (Phase 1 audit
  // finding). A real container orchestrator sends SIGTERM on every redeploy/scale-down; without
  // this, that's an ungraceful kill, not a drain.
  app.enableShutdownHooks();

  // M31 Phase 8 — baseline security headers (Content-Security-Policy is deliberately left to
  // helmet's own conservative default here; a stricter, frontend-specific CSP is the web app's own
  // concern, not this API's). `hsts` only takes effect once this API is actually served over HTTPS
  // in a real environment — helmet itself does not enforce HTTPS, it only sets the header.
  app.use(
    helmet({
      hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );

  app.enableCors({ origin: configService.get<string[]>('app.corsOrigin') });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new RequestContextUserInterceptor(app.get(RequestContextService)));

  // M31 Phase 4/8 — Swagger (the full API surface: every DTO, every route, including admin routes)
  // is real information disclosure the moment it's reachable from the public internet (Phase 1
  // audit finding: it was previously mounted unconditionally in every environment). Never mounted
  // in `production`; still available in `development`/`staging` for real engineering use.
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('German Job Engine API')
      .setDescription('REST API for the German Job Engine platform')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);
  } else {
    logger.log('Swagger (/api/docs) is disabled in production.');
  }

  const port = configService.get<number>('app.port') ?? 4000;
  await app.listen(port);
  logger.log(`German Job Engine API listening on port ${port} [environment=${environment}, runTicks=${configService.get<boolean>('app.runTicks', true)}].`);
}

bootstrap();
