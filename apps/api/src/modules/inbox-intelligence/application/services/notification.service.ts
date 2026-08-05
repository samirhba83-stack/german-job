import { Inject, Injectable } from '@nestjs/common';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { NotificationRepository, NOTIFICATION_REPOSITORY, NotificationPreferenceRepository, NOTIFICATION_PREFERENCE_REPOSITORY } from '../../domain/ports/notification.repository';
import { NotificationRecord, NotificationKind, NOTIFICATION_KIND_PREFERENCE_FIELD } from '../../domain/models/notification';

export interface NotifyInput {
  readonly userId: string;
  readonly kind: NotificationKind;
  readonly relatedInboxMessageId: string | null;
  readonly relatedApplicationId: string | null;
  readonly title: string;
  readonly body: string;
  /** A stable key identifying the underlying real-world event (e.g. the inbox message id) — the
   * real dedup key, never a random value (Phase 18: "support notification deduplication"). */
  readonly dedupeKey: string;
}

/**
 * M29 Phase 18 — the first real, durable, backend-sourced notification service in this codebase
 * (Phase 1 audit: previously only a transient frontend toast store existed). Respects
 * `NotificationPreferenceRecord` (separate from inbox consent) before ever creating a row — a
 * disabled preference means this call is a real, silent no-op, not merely a suppressed display.
 * Never creates noisy per-automatic-acknowledgment notifications — callers only invoke this for
 * the brief's own named meaningful events, never for every classification.
 */
@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY) private readonly preferences: NotificationPreferenceRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
  ) {}

  async notify(input: NotifyInput): Promise<NotificationRecord | null> {
    const preference = await this.preferences.findByUserId(input.userId);
    const preferenceField = NOTIFICATION_KIND_PREFERENCE_FIELD[input.kind];
    const enabled = preference ? preference[preferenceField] : true; // no row yet = every default is enabled
    if (!enabled) return null;

    const now = this.clock.now();
    const { notification } = await this.notifications.createIfNotDuplicate(
      { userId: input.userId, kind: input.kind, relatedInboxMessageId: input.relatedInboxMessageId, relatedApplicationId: input.relatedApplicationId, title: input.title, body: input.body, dedupeKey: input.dedupeKey },
      now,
    );
    return notification;
  }

  async listForUser(userId: string, limit: number, offset: number): Promise<NotificationRecord[]> {
    return this.notifications.listByUserId(userId, limit, offset);
  }

  async markRead(id: string): Promise<void> {
    await this.notifications.markRead(id, this.clock.now());
  }

  async updatePreferences(userId: string, patch: Parameters<NotificationPreferenceRepository['upsert']>[1]) {
    return this.preferences.upsert(userId, patch);
  }

  async getPreferences(userId: string) {
    return (await this.preferences.findByUserId(userId)) ?? this.preferences.upsert(userId, {});
  }
}
