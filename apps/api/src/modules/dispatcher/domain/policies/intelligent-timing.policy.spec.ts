import { IntelligentTimingPolicy } from './intelligent-timing.policy';
import { DEFAULT_DISPATCHER_CONFIG } from '../dispatcher-config';

describe('IntelligentTimingPolicy', () => {
  const policy = new IntelligentTimingPolicy(DEFAULT_DISPATCHER_CONFIG);

  it('recommends the current instant when already within business hours', () => {
    const from = new Date('2026-01-05T10:00:00.000Z'); // Monday, 10:00

    const recommendation = policy.recommend(from, 'UTC');

    expect(recommendation.recommendedAt).toEqual(from);
    expect(recommendation.reasonCode).toBe('WITHIN_BUSINESS_HOURS');
  });

  it('recommends the next business morning when starting late at night on a weekday', () => {
    const from = new Date('2026-01-05T23:00:00.000Z'); // Monday, 23:00

    const recommendation = policy.recommend(from, 'UTC');

    expect(recommendation.recommendedAt).toEqual(new Date('2026-01-06T08:00:00.000Z')); // Tuesday 08:00
    expect(recommendation.reasonCode).toBe('OUTSIDE_BUSINESS_HOURS');
    expect(recommendation.explanation).toContain('advisory');
  });

  it('recommends the following Monday morning when starting on a weekend', () => {
    const from = new Date('2026-01-10T10:00:00.000Z'); // Saturday

    const recommendation = policy.recommend(from, 'UTC');

    expect(recommendation.recommendedAt).toEqual(new Date('2026-01-12T08:00:00.000Z')); // Monday 08:00
    expect(recommendation.reasonCode).toBe('OUTSIDE_BUSINESS_HOURS');
  });
});
