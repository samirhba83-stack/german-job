import { Education } from './education.vo';
import { InvalidDateRangeException } from '../exceptions/invalid-date-range.exception';

describe('Education', () => {
  it('creates a valid entry', () => {
    const entry = Education.create({
      institution: 'TU Berlin',
      degree: 'M.Sc. Computer Science',
      startDate: new Date('2018-10-01'),
      endDate: new Date('2020-09-30'),
    });

    expect(entry.institution).toBe('TU Berlin');
    expect(entry.fieldOfStudy).toBeNull();
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      Education.create({
        institution: 'TU Berlin',
        degree: 'M.Sc.',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2019-01-01'),
      }),
    ).toThrow(InvalidDateRangeException);
  });
});
