import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configurations } from '../../../config/configuration';
import { EnvironmentValidationService } from './environment-validation.service';

/** M31 Phase 7 — a minimal, throwaway application context (`main.ts`'s `validateEnvironmentOrExit`)
 * loads only `ConfigModule` + `EnvironmentValidationService` — deliberately NOT the full
 * `AppModule` — so real, fail-closed startup validation can run and report its clear, itemized
 * result BEFORE the full module tree (whose individual providers, e.g. `JwtStrategy`, throw their
 * own raw, unhelpful errors on a missing secret) is ever instantiated. See `main.ts`'s own doc
 * comment for the self-caught ordering bug this fixes. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: configurations, envFilePath: ['../../.env', '.env'] })],
  providers: [EnvironmentValidationService],
})
export class PreflightModule {}
