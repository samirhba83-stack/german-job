import { EnglishLevel } from '@german-job-engine/shared-types';
import { EnglishLanguageRequirement } from './english-language-requirement.vo';

describe('EnglishLanguageRequirement', () => {
  it('creates a valid requirement', () => {
    const requirement = EnglishLanguageRequirement.create(EnglishLevel.C1, false);

    expect(requirement.level).toBe(EnglishLevel.C1);
    expect(requirement.required).toBe(false);
  });
});
