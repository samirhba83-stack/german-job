import { AvailabilityStatus } from '@german-job-engine/shared-types';
import { Availability } from './availability.vo';

describe('Availability', () => {
  it('defaults availableFrom to null when not provided', () => {
    const availability = Availability.create(AvailabilityStatus.IMMEDIATELY);

    expect(availability.status).toBe(AvailabilityStatus.IMMEDIATELY);
    expect(availability.availableFrom).toBeNull();
  });

  it('stores the provided availableFrom date', () => {
    const date = new Date('2026-09-01');
    const availability = Availability.create(AvailabilityStatus.WITHIN_1_MONTH, date);

    expect(availability.availableFrom).toEqual(date);
  });
});
