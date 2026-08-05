import { TrustScore } from './trust-score.vo';

describe('TrustScore', () => {
  it('creates a valid trust score', () => {
    const date = new Date('2026-01-01');
    const score = TrustScore.create(90, date);

    expect(score.score).toBe(90);
    expect(score.computedAt).toBe(date);
  });

  it('rejects a score outside 0-100', () => {
    expect(() => TrustScore.create(-1)).toThrow(/between 0 and 100/);
    expect(() => TrustScore.create(101)).toThrow(/between 0 and 100/);
  });
});
