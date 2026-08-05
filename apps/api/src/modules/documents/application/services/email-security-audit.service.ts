import { Inject, Injectable } from '@nestjs/common';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import {
  EmailSecurityAuditRepository,
  EMAIL_SECURITY_AUDIT_REPOSITORY,
  RecordEmailSecurityAuditEventInput,
  EmailSecurityAuditEventFilter,
  EmailSecurityAuditEventRecord,
} from '../../domain/ports/email-security-audit.repository';

/** M28.5 — the single place every attachment/sender/domain-readiness decision is recorded
 * (Non-Negotiable Principle #12: "every attachment and sender decision must be auditable").
 * Every other service in this milestone calls through here rather than writing to the audit
 * table directly, matching `EmailTrackingService`'s (M28) identical role for delivery events. */
@Injectable()
export class EmailSecurityAuditService {
  constructor(
    @Inject(EMAIL_SECURITY_AUDIT_REPOSITORY) private readonly repository: EmailSecurityAuditRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
  ) {}

  async record(input: RecordEmailSecurityAuditEventInput): Promise<void> {
    await this.repository.record(input, this.clock.now());
  }

  async list(filter: EmailSecurityAuditEventFilter, limit: number, offset: number): Promise<EmailSecurityAuditEventRecord[]> {
    return this.repository.list(filter, limit, offset);
  }
}
