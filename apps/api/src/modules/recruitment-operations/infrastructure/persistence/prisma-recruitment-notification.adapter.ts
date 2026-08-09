import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@german-job-engine/database';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { RecruitmentNotificationPort, RecruitmentNotificationInput, RecruitmentNotificationKind } from '../../domain/ports/recruitment-notification.port';

const PREFERENCE_FIELD_BY_KIND: Readonly<Record<RecruitmentNotificationKind, 'followUpControlChangedEnabled' | 'taskDeadlineEnabled' | 'transitionExecutionFailedEnabled' | 'offerOrAcceptanceEnabled' | 'ambiguousReplyReviewEnabled'>> = {
  FOLLOW_UP_PAUSED: 'followUpControlChangedEnabled',
  FOLLOW_UP_STOPPED: 'followUpControlChangedEnabled',
  FOLLOW_UP_RESUME_AVAILABLE: 'followUpControlChangedEnabled',
  OFFER_REVIEW_REQUIRED: 'offerOrAcceptanceEnabled',
  MANUAL_REVIEW_REQUIRED: 'ambiguousReplyReviewEnabled',
  TRANSITION_EXECUTION_FAILED: 'transitionExecutionFailedEnabled',
  DEADLINE_APPROACHING: 'taskDeadlineEnabled',
  TASK_OVERDUE: 'taskDeadlineEnabled',
};

@Injectable()
export class PrismaRecruitmentNotificationAdapter implements RecruitmentNotificationPort {
  private readonly logger = new Logger(PrismaRecruitmentNotificationAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(input: RecruitmentNotificationInput): Promise<void> {
    const preference = await this.prisma.notificationPreference.findUnique({ where: { userId: input.userId } });
    const field = PREFERENCE_FIELD_BY_KIND[input.kind];
    // No preference row yet defaults to enabled (matches every notification kind's own default
    // `true` column value — a user who has never opened notification settings still gets these).
    if (preference && preference[field] === false) {
      return;
    }

    try {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          kind: input.kind as unknown as Prisma.NotificationCreateInput['kind'],
          relatedInboxMessageId: null,
          relatedApplicationId: input.relatedApplicationId,
          title: input.title,
          body: input.body,
          dedupeKey: input.dedupeKey,
        },
      });
    } catch (error) {
      // A genuine duplicate (the same dedupeKey already exists) is a real, expected, silent
      // no-op — the same discipline as M29's `NotificationRepository.createIfNotDuplicate()`.
      const isDuplicate = error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002';
      if (!isDuplicate) {
        this.logger.warn(`Failed to write recruitment notification (${input.kind}) for user ${input.userId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
