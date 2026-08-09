import { ApplicationOperationalDecisionRecord, RecordOperationalDecisionInput } from '../models/application-operational-decision';

export const APPLICATION_OPERATIONAL_DECISION_REPOSITORY = Symbol('APPLICATION_OPERATIONAL_DECISION_REPOSITORY');

export interface ApplicationOperationalDecisionRepository {
  /** Real dedup on `idempotencyKey` — a duplicate provider-event replay resolves to the same
   * existing row rather than creating a second decision (Non-Negotiable Principle #9). */
  recordIfNotDuplicate(input: RecordOperationalDecisionInput, now: Date): Promise<{ readonly decision: ApplicationOperationalDecisionRecord; readonly wasNewlyCreated: boolean }>;
  listByApplicationId(applicationId: string): Promise<ApplicationOperationalDecisionRecord[]>;
}
