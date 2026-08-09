import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContextService } from './request-context.service';

/**
 * M31 Phase 15 — real structured (JSON) logging, replacing the explicit placeholder
 * `LoggerModule` had carried since it was first scaffolded ("Placeholder for a structured logger
 * provider (e.g. Pino/Winston) — uses Nest's built-in Logger for now" — Phase 1 audit finding).
 *
 * Deliberately extends `ConsoleLogger` (Nest's own real, tested implementation) and overrides
 * `printMessages` — NOT `formatMessage` (a self-caught mistake while building this: `formatMessage`
 * only ever receives the context/pid/level pieces AFTER they've already been ANSI-color-wrapped
 * for terminal display; `printMessages` receives the raw, clean `context` string extracted from
 * whatever the caller passed, which is what a real structured log line needs). Verified by reading
 * the installed `@nestjs/common`'s own compiled source, not assumed.
 *
 * The context-propagation mechanism this relies on: `Logger`'s (the class every module in this
 * codebase already calls `new Logger(SomeClass.name)` on — hundreds of call sites, none of which
 * need to change) INSTANCE methods delegate to `Logger.staticInstanceRef`, a single class-level
 * reference `app.useLogger()` overwrites — so wiring this logger into `main.ts` once redirects
 * every existing `new Logger(...)` call site in the entire application automatically, with zero
 * changes anywhere else. Also verified by reading the compiled source, not assumed.
 *
 * Output is one JSON object per line: `{ timestamp, level, context, message, environment,
 * requestId?, userId? }` — a real log-aggregation tool (Phase 17, vendor TBD) can parse this
 * directly, no custom grok/regex pattern needed.
 *
 * Redaction: this codebase's established discipline (every M20-M30 milestone) is that no call
 * site ever passes raw email/CV/OAuth-token content to a logger call in the first place — an
 * audit event's own `detail` field is deliberately kept to structured, non-content summaries
 * (confirmed throughout this session's own work). This logger does not attempt a second,
 * pattern-matching redaction layer on top of that (a regex-based scanner over arbitrary log
 * strings would be unreliable and could create false confidence) — the real guarantee is "nothing
 * sensitive is ever constructed into a log message to begin with," enforced by code review
 * discipline, not by this transport.
 */
@Injectable()
export class StructuredLoggerService extends ConsoleLogger {
  constructor(
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {
    super();
  }

  protected printMessages(messages: unknown[], context = '', logLevel: LogLevel = 'log', writeStreamType?: 'stdout' | 'stderr'): void {
    const requestContext = this.requestContext.current();
    const environment = this.config.get<string>('app.environment', 'development');

    for (const message of messages) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: logLevel,
        context: context || 'Application',
        message: message instanceof Error ? { message: message.message, stack: message.stack } : message,
        environment,
        ...(requestContext?.requestId ? { requestId: requestContext.requestId } : {}),
        ...(requestContext?.userId ? { userId: requestContext.userId } : {}),
      };
      process[writeStreamType ?? 'stdout'].write(JSON.stringify(entry) + '\n');
    }
  }
}
