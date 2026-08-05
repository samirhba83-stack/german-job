import { GermanLevel } from '@german-job-engine/shared-types';
import { GermanLanguageRequirement } from './german-language-requirement.vo';

describe('GermanLanguageRequirement', () => {
  it('creates a valid requirement', () => {
    const requirement = GermanLanguageRequirement.create(GermanLevel.B2, true);

    expect(requirement.level).toBe(GermanLevel.B2);
    expect(requirement.required).toBe(true);
  });
});
