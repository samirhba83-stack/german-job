import { ConfidenceScore } from './confidence-score.vo';
import { InvalidConfidenceScoreException } from '../exceptions/invalid-confidence-score.exception';

describe('ConfidenceScore', () => {
  it.each([0, 0.5, 1])('accepts %s', (value) => {
    expect(ConfidenceScore.create(value).value).toBe(value);
  });

  it.each([-0.01, 1.01])('rejects %s', (value) => {
    expect(() => ConfidenceScore.create(value)).toThrow(InvalidConfidenceScoreException);
  });
});
