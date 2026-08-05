import { Inject, Injectable } from '@nestjs/common';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailEventRepository, EMAIL_EVENT_REPOSITORY } from '../../domain/ports/email-event.repository';
import { EmailEventType } from '../../domain/models/email-message';

/**
 * M28 — the single place every real email lifecycle transition is recorded
 * (queued/sending/sent/delivered/deferred/bounced/complained/opened/clicked/failed/dead-lettered/
 * suppressed) as an immutable `EmailEvent` row. Every other service in this module calls through
 * here rather than writing to the event table directly, so the "track every email" guarantee has
 * exactly one real implementation.
 */
@Injectable()
export class EmailTrackingService {
  constructor(
    @Inject(EMAIL_EVENT_REPOSITORY) private readonly events: EmailEventRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
  ) {}

  async track(
    emailMessageId: string,
    eventType: EmailEventType,
    options: { providerId?: string | null; detail?: string | null; metadata?: Readonly<Record<string, string>> } = {},
  ): Promise<void> {
    await this.events.record(
      {
        emailMessageId,
        eventType,
        providerId: options.providerId ?? null,
        detail: options.detail ?? null,
        metadata: options.metadata ?? {},
      },
      this.clock.now(),
    );
  }

  async history(emailMessageId: string) {
    return this.events.listForMessage(emailMessageId);
  }
}
