import { HiringQuality } from './hiring-quality.vo';

describe('HiringQuality', () => {
  it('defaults computedAt to now when not provided', () => {
    const before = Date.now();
    const quality = HiringQuality.create(80);

    expect(quality.score).toBe(80);
    expect(quality.computedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('rejects a score outside 0-100', () => {
    expect(() => HiringQuality.create(-1)).toThrow(/between 0 and 100/);
    expect(() => HiringQuality.create(101)).toThrow(/between 0 and 100/);
  });
});
