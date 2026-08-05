import { EnglishLevel } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface EnglishLanguageRequirementProps {
  level: EnglishLevel;
  required: boolean;
}

export class EnglishLanguageRequirement extends ValueObject<EnglishLanguageRequirementProps> {
  private constructor(props: EnglishLanguageRequirementProps) {
    super(props);
  }

  get level(): EnglishLevel {
    return this.props.level;
  }

  get required(): boolean {
    return this.props.required;
  }

  static create(level: EnglishLevel, required: boolean): EnglishLanguageRequirement {
    return new EnglishLanguageRequirement({ level, required });
  }
}
