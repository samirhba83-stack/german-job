import { ExperienceLevel } from '@german-job-engine/shared-types';
import { ExperienceRequirement } from './experience-requirement.vo';

describe('ExperienceRequirement', () => {
  it('creates a valid requirement', () => {
    const requirement = ExperienceRequirement.create(3, ExperienceLevel.MID_LEVEL);

    expect(requirement.minYears).toBe(3);
    expect(requirement.level).toBe(ExperienceLevel.MID_LEVEL);
  });

  it('rejects a negative minYears', () => {
    expect(() => ExperienceRequirement.create(-1, ExperienceLevel.JUNIOR)).toThrow(/between 0 and 50/);
  });

  it('rejects a minYears above the maximum', () => {
    expect(() => ExperienceRequirement.create(51, ExperienceLevel.SENIOR)).toThrow(/between 0 and 50/);
  });
});
