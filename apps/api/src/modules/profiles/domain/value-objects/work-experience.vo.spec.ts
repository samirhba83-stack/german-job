import { WorkExperience } from './work-experience.vo';
import { InvalidDateRangeException } from '../exceptions/invalid-date-range.exception';

describe('WorkExperience', () => {
  it('creates a valid entry', () => {
    const entry = WorkExperience.create({
      company: 'Acme GmbH',
      title: 'Software Engineer',
      startDate: new Date('2022-01-01'),
      endDate: new Date('2023-01-01'),
      description: '  building things  ',
    });

    expect(entry.company).toBe('Acme GmbH');
    expect(entry.description).toBe('building things');
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      WorkExperience.create({
        company: 'Acme GmbH',
        title: 'Engineer',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2022-01-01'),
      }),
    ).toThrow(InvalidDateRangeException);
  });

  it('rejects a blank company name', () => {
    expect(() =>
      WorkExperience.create({ company: '  ', title: 'Engineer', startDate: new Date() }),
    ).toThrow(/company name/);
  });
});
