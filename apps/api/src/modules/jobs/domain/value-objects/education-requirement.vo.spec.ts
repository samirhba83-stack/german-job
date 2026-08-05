import { EducationLevel } from '@german-job-engine/shared-types';
import { EducationRequirement } from './education-requirement.vo';

describe('EducationRequirement', () => {
  it('defaults required to false and fieldOfStudy to null', () => {
    const requirement = EducationRequirement.create({ level: EducationLevel.BACHELOR });

    expect(requirement.required).toBe(false);
    expect(requirement.fieldOfStudy).toBeNull();
  });

  it('trims the field of study', () => {
    const requirement = EducationRequirement.create({
      level: EducationLevel.MASTER,
      fieldOfStudy: '  Computer Science  ',
      required: true,
    });

    expect(requirement.fieldOfStudy).toBe('Computer Science');
    expect(requirement.required).toBe(true);
  });
});
