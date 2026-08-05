import { describe, expect, it } from 'vitest';
import { CampaignOutcomeGoal, CampaignStrategyType, Weekday } from '@german-job-engine/shared-types';
import { hasCampaignFormErrors, validateCampaignPayload } from '@/features/campaigns/lib/validate-campaign-payload';
import type { CampaignPayload } from '@/features/campaigns/api/campaigns.api';

function buildValidPayload(overrides: Partial<CampaignPayload> = {}): CampaignPayload {
  return {
    name: 'Berlin Backend Roles',
    goal: { targetApplicationCount: 20, desiredOutcome: CampaignOutcomeGoal.REPLIES, deadline: null },
    strategy: { type: CampaignStrategyType.BALANCED, parameters: {} },
    batchPlan: { baseBatchSize: 10, minBatchSize: 1, maxBatchSize: 20, adaptive: false, expansionIncrement: null },
    executionWindow: {
      allowedWeekdays: [Weekday.MONDAY],
      dailyStartHour: 8,
      dailyEndHour: 18,
      timezone: 'Europe/Berlin',
      respectHolidays: true,
    },
    rateLimitProfile: { maxPerDay: 50, maxPerHour: 10, maxPerCompanyPerWindow: 1 },
    ...overrides,
  };
}

describe('validateCampaignPayload', () => {
  it('accepts a fully valid payload with zero errors', () => {
    expect(validateCampaignPayload(buildValidPayload())).toEqual({});
  });

  it('rejects an empty name', () => {
    const errors = validateCampaignPayload(buildValidPayload({ name: '  ' }));
    expect(errors.name).toBeDefined();
  });

  it('rejects a name over 150 characters', () => {
    const errors = validateCampaignPayload(buildValidPayload({ name: 'x'.repeat(151) }));
    expect(errors.name).toBeDefined();
  });

  it('rejects a target application count below 1', () => {
    const errors = validateCampaignPayload(
      buildValidPayload({ goal: { targetApplicationCount: 0, desiredOutcome: CampaignOutcomeGoal.REPLIES, deadline: null } }),
    );
    expect(errors.targetApplicationCount).toBeDefined();
  });

  it('rejects maxBatchSize smaller than minBatchSize', () => {
    const errors = validateCampaignPayload(
      buildValidPayload({ batchPlan: { baseBatchSize: 5, minBatchSize: 10, maxBatchSize: 5, adaptive: false, expansionIncrement: null } }),
    );
    expect(errors.maxBatchSize).toBeDefined();
  });

  it('rejects an execution window with no allowed weekdays', () => {
    const errors = validateCampaignPayload(
      buildValidPayload({
        executionWindow: { allowedWeekdays: [], dailyStartHour: 8, dailyEndHour: 18, timezone: 'Europe/Berlin', respectHolidays: true },
      }),
    );
    expect(errors.allowedWeekdays).toBeDefined();
  });

  it('rejects dailyEndHour at or before dailyStartHour', () => {
    const errors = validateCampaignPayload(
      buildValidPayload({
        executionWindow: {
          allowedWeekdays: [Weekday.MONDAY],
          dailyStartHour: 18,
          dailyEndHour: 8,
          timezone: 'Europe/Berlin',
          respectHolidays: true,
        },
      }),
    );
    expect(errors.dailyEndHour).toBeDefined();
  });

  it('rejects dailyStartHour outside 0-23', () => {
    const errors = validateCampaignPayload(
      buildValidPayload({
        executionWindow: {
          allowedWeekdays: [Weekday.MONDAY],
          dailyStartHour: 24,
          dailyEndHour: 18,
          timezone: 'Europe/Berlin',
          respectHolidays: true,
        },
      }),
    );
    expect(errors.dailyStartHour).toBeDefined();
  });

  it('rejects a rate limit profile with a value below 1 when present', () => {
    const errors = validateCampaignPayload(buildValidPayload({ rateLimitProfile: { maxPerDay: 0, maxPerHour: 10, maxPerCompanyPerWindow: 1 } }));
    expect(errors.maxPerDay).toBeDefined();
  });

  it('does not validate rate limits at all when the profile is omitted (matches the backend: it is optional)', () => {
    const errors = validateCampaignPayload(buildValidPayload({ rateLimitProfile: undefined }));
    expect(errors.maxPerDay).toBeUndefined();
    expect(errors.maxPerHour).toBeUndefined();
    expect(errors.maxPerCompanyPerWindow).toBeUndefined();
  });
});

describe('hasCampaignFormErrors', () => {
  it('is false for an empty errors object', () => {
    expect(hasCampaignFormErrors({})).toBe(false);
  });

  it('is true when at least one error is present', () => {
    expect(hasCampaignFormErrors({ name: 'required' })).toBe(true);
  });
});
