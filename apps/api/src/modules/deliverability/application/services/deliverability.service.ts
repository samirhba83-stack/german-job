import { Inject, Injectable } from '@nestjs/common';
import { EmailMessageStatus as PrismaEmailMessageStatus } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { EmailQueueRepository, EMAIL_QUEUE_REPOSITORY } from '../../domain/ports/email-queue.repository';
import { EmailSuppressionRepository, EMAIL_SUPPRESSION_REPOSITORY, EmailSuppressionEntryRecord } from '../../domain/ports/email-suppression.repository';
import { EmailMessageRecord } from '../../domain/models/email-message';
import { DeliverabilityHealthLabel, ReputationSnapshot } from '../../domain/models/reputation-snapshot';
import { EmailTrackingService } from './email-tracking.service';

/**
 * M28 — bounce/complaint handling, the suppression list, and reputation scoring. Every method
 * here is called from a real, signature-verified provider webhook (Resend/SES/SendGrid) or an
 * admin action — never speculatively, never on a guess about what "probably" bounced.
 */
@Injectable()
export class DeliverabilityService {
  constructor(
    @Inject(EMAIL_SUPPRESSION_REPOSITORY) private readonly suppression: EmailSuppressionRepository,
    @Inject(EMAIL_QUEUE_REPOSITORY) private readonly queue: EmailQueueRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    private readonly tracking: EmailTrackingService,
    private readonly prisma: PrismaService,
  ) {}

  async isSuppressed(emailAddress: string): Promise<boolean> {
    return this.suppression.isSuppressed(emailAddress);
  }

  async handleHardBounce(message: EmailMessageRecord, providerId: string, detail: string): Promise<void> {
    const now = this.clock.now();
    await this.tracking.track(message.id, 'BOUNCED_HARD', { providerId, detail });
    await this.queue.applyProviderStatus(message.id, 'BOUNCED', now);
    await this.suppression.suppress(message.recipientEmail, 'HARD_BOUNCE', providerId, detail, now);
  }

  /** A soft bounce is transient by definition (full mailbox, temporary DNS failure, greylisting)
   * — it does not suppress the address; the provider's own MTA typically keeps retrying for a
   * period before either succeeding or escalating to a hard bounce. This only records the signal. */
  async handleSoftBounce(message: EmailMessageRecord, providerId: string, detail: string): Promise<void> {
    await this.tracking.track(message.id, 'BOUNCED_SOFT', { providerId, detail });
    await this.queue.applyProviderStatus(message.id, 'DEFERRED', this.clock.now());
  }

  async handleComplaint(message: EmailMessageRecord, providerId: string, detail: string): Promise<void> {
    const now = this.clock.now();
    await this.tracking.track(message.id, 'COMPLAINED', { providerId, detail });
    await this.queue.applyProviderStatus(message.id, 'COMPLAINED', now);
    await this.suppression.suppress(message.recipientEmail, 'COMPLAINT', providerId, detail, now);
  }

  async handleDelivered(message: EmailMessageRecord, providerId: string): Promise<void> {
    await this.tracking.track(message.id, 'DELIVERED', { providerId });
    await this.queue.applyProviderStatus(message.id, 'DELIVERED', this.clock.now());
  }

  async handleOpened(message: EmailMessageRecord, providerId: string): Promise<void> {
    // Additive signal only — DELIVERED remains the message's real status; open/click never revert
    // or advance it, they are just further real events in the same immutable history.
    await this.tracking.track(message.id, 'OPENED', { providerId });
  }

  async handleClicked(message: EmailMessageRecord, providerId: string, url: string | null): Promise<void> {
    await this.tracking.track(message.id, 'CLICKED', { providerId, detail: url });
  }

  async suppressManually(emailAddress: string, note: string, adminUserId: string): Promise<EmailSuppressionEntryRecord> {
    return this.suppression.suppress(emailAddress, 'MANUAL', `ADMIN:${adminUserId}`, note, this.clock.now());
  }

  async unsuppress(emailAddress: string): Promise<void> {
    await this.suppression.remove(emailAddress);
  }

  async listSuppressions(limit: number, offset: number): Promise<EmailSuppressionEntryRecord[]> {
    return this.suppression.list(limit, offset);
  }

  async suppressionCount(): Promise<number> {
    return this.suppression.count();
  }

  /** Real, computed-on-read reputation over a trailing window — see `ReputationSnapshot`'s own
   * doc comment for why this is never a stored score. */
  async getReputationSnapshot(windowDays = 30): Promise<ReputationSnapshot> {
    const windowStart = new Date(this.clock.now().getTime() - windowDays * 24 * 60 * 60 * 1000);
    const sentStatuses: PrismaEmailMessageStatus[] = [
      PrismaEmailMessageStatus.SENT,
      PrismaEmailMessageStatus.DELIVERED,
      PrismaEmailMessageStatus.BOUNCED,
      PrismaEmailMessageStatus.COMPLAINED,
      PrismaEmailMessageStatus.DEFERRED,
    ];

    const [sent, delivered, bounced, complained] = await Promise.all([
      this.prisma.emailMessage.count({ where: { updatedAt: { gte: windowStart }, status: { in: sentStatuses } } }),
      this.prisma.emailMessage.count({ where: { updatedAt: { gte: windowStart }, status: PrismaEmailMessageStatus.DELIVERED } }),
      this.prisma.emailMessage.count({ where: { updatedAt: { gte: windowStart }, status: PrismaEmailMessageStatus.BOUNCED } }),
      this.prisma.emailMessage.count({ where: { updatedAt: { gte: windowStart }, status: PrismaEmailMessageStatus.COMPLAINED } }),
    ]);

    return this.buildSnapshot(windowDays, sent, delivered, bounced, complained);
  }

  private buildSnapshot(windowDays: number, sent: number, delivered: number, bounced: number, complained: number): ReputationSnapshot {
    const bounceRate = sent > 0 ? bounced / sent : 0;
    const complaintRate = sent > 0 ? complained / sent : 0;
    return { windowDays, sent, delivered, bounced, complained, bounceRate, complaintRate, healthLabel: this.classify(bounceRate, complaintRate) };
  }

  private classify(bounceRate: number, complaintRate: number): DeliverabilityHealthLabel {
    if (complaintRate > 0.001 || bounceRate > 0.1) return 'CRITICAL';
    if (complaintRate > 0.0005 || bounceRate > 0.05) return 'AT_RISK';
    return 'HEALTHY';
  }
}
