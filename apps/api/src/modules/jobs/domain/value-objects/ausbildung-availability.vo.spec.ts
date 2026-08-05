import { AusbildungAvailability } from './ausbildung-availability.vo';

describe('AusbildungAvailability', () => {
  it('defaults durationMonths to null', () => {
    const availability = AusbildungAvailability.create({ isAusbildungPosition: false });

    expect(availability.durationMonths).toBeNull();
  });

  it('accepts a valid duration', () => {
    const availability = AusbildungAvailability.create({ isAusbildungPosition: true, durationMonths: 36 });

    expect(availability.durationMonths).toBe(36);
  });

  it('rejects a duration out of range', () => {
    expect(() => AusbildungAvailability.create({ isAusbildungPosition: true, durationMonths: 0 })).toThrow(
      /between 1 and 60/,
    );
    expect(() => AusbildungAvailability.create({ isAusbildungPosition: true, durationMonths: 61 })).toThrow(
      /between 1 and 60/,
    );
  });
});
