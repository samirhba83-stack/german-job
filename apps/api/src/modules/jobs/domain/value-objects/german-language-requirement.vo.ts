import { GermanLevel } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface GermanLanguageRequirementProps {
  level: GermanLevel;
  required: boolean;
}

export class GermanLanguageRequirement extends ValueObject<GermanLanguageRequirementProps> {
  private constructor(props: GermanLanguageRequirementProps) {
    super(props);
  }

  get level(): GermanLevel {
    return this.props.level;
  }

  get required(): boolean {
    return this.props.required;
  }

  static create(level: GermanLevel, required: boolean): GermanLanguageRequirement {
    return new GermanLanguageRequirement({ level, required });
  }
}
