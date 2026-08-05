import { NotificationRecord, CreateNotificationInput, NotificationPreferenceRecord } from '../models/notification';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');
export const NOTIFICATION_PREFERENCE_REPOSITORY = Symbol('NOTIFICATION_PREFERENCE_REPOSITORY');

export interface NotificationRepository {
  /** Idempotent by `(userId, dedupeKey)` — a repeat call for the same logical event returns the
   * existing row untouched, the real DB-level dedup backstop (Phase 18: "support notification
   * deduplication"). */
  createIfNotDuplicate(input: CreateNotificationInput, now: Date): Promise<{ readonly notification: NotificationRecord; readonly wasNewlyCreated: boolean }>;
  listByUserId(userId: string, limit: number, offset: number): Promise<NotificationRecord[]>;
  markRead(id: string, now: Date): Promise<void>;
}

export interface NotificationPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreferenceRecord | null>;
  /** Every field defaults to enabled — a first-ever call for a user with no row yet creates one
   * with all defaults, matching this codebase's own established "explicit patch, sane defaults"
   * idiom. */
  upsert(userId: string, patch: Partial<Omit<NotificationPreferenceRecord, 'userId'>>): Promise<NotificationPreferenceRecord>;
}
