import type { CampaignPayload } from '../api/campaigns.api';

export type CampaignFormErrors = Partial<{
  name: string;
  targetApplicationCount: string;
  baseBatchSize: string;
  minBatchSize: string;
  maxBatchSize: string;
  allowedWeekdays: string;
  dailyStartHour: string;
  dailyEndHour: string;
  timezone: string;
  maxPerDay: string;
  maxPerHour: string;
  maxPerCompanyPerWindow: string;
}>;

/**
 * Mirrors the real backend `class-validator` constraints on `CreateCampaignDto` and its nested
 * DTOs exactly (`apps/api/src/modules/campaigns/application/dto/*.ts`) — every bound here is a
 * real constraint the backend enforces, not a client-side guess. This exists so the form can give
 * an immediate, specific error instead of a round trip to learn the same thing from a 400, and so
 * the mapping has one place to stay in sync if the backend constraints ever change. The backend
 * remains the actual authority; this is a convenience, not a replacement.
 */
export function validateCampaignPayload(payload: CampaignPayload): CampaignFormErrors {
  const errors: CampaignFormErrors = {};

  const name = payload.name.trim();
  if (name.length < 1 || name.length > 150) {
    errors.name = 'Name must be between 1 and 150 characters.';
  }

  if (!Number.isInteger(payload.goal.targetApplicationCount) || payload.goal.targetApplicationCount < 1) {
    errors.targetApplicationCount = 'Target application count must be a whole number of at least 1.';
  }

  const { baseBatchSize, minBatchSize, maxBatchSize } = payload.batchPlan;
  if (!Number.isInteger(baseBatchSize) || baseBatchSize < 1) {
    errors.baseBatchSize = 'Base batch size must be a whole number of at least 1.';
  }
  if (!Number.isInteger(minBatchSize) || minBatchSize < 1) {
    errors.minBatchSize = 'Minimum batch size must be a whole number of at least 1.';
  }
  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1) {
    errors.maxBatchSize = 'Maximum batch size must be a whole number of at least 1.';
  } else if (!errors.minBatchSize && maxBatchSize < minBatchSize) {
    errors.maxBatchSize = 'Maximum batch size cannot be smaller than the minimum.';
  }

  if (payload.executionWindow.allowedWeekdays.length < 1) {
    errors.allowedWeekdays = 'Select at least one allowed weekday.';
  }

  const { dailyStartHour, dailyEndHour, timezone } = payload.executionWindow;
  if (!Number.isInteger(dailyStartHour) || dailyStartHour < 0 || dailyStartHour > 23) {
    errors.dailyStartHour = 'Start hour must be a whole number between 0 and 23.';
  }
  if (!Number.isInteger(dailyEndHour) || dailyEndHour < 1 || dailyEndHour > 24) {
    errors.dailyEndHour = 'End hour must be a whole number between 1 and 24.';
  } else if (!errors.dailyStartHour && dailyEndHour <= dailyStartHour) {
    errors.dailyEndHour = 'End hour must be later than the start hour.';
  }
  if (timezone.trim().length === 0) {
    errors.timezone = 'Timezone is required.';
  }

  if (payload.rateLimitProfile) {
    const { maxPerDay, maxPerHour, maxPerCompanyPerWindow } = payload.rateLimitProfile;
    if (!Number.isInteger(maxPerDay) || maxPerDay < 1) {
      errors.maxPerDay = 'Max per day must be a whole number of at least 1.';
    }
    if (!Number.isInteger(maxPerHour) || maxPerHour < 1) {
      errors.maxPerHour = 'Max per hour must be a whole number of at least 1.';
    }
    if (!Number.isInteger(maxPerCompanyPerWindow) || maxPerCompanyPerWindow < 1) {
      errors.maxPerCompanyPerWindow = 'Max per company must be a whole number of at least 1.';
    }
  }

  return errors;
}

export function hasCampaignFormErrors(errors: CampaignFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
