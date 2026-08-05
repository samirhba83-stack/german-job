import { ExperienceLevel } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface ExperienceRequirementProps {
  minYears: number;
  level: ExperienceLevel;
}

const MAX_YEARS = 50;

export class ExperienceRequirement extends ValueObject<ExperienceRequirementProps> {
  private constructor(props: ExperienceRequirementProps) {
    super(props);
  }

  get minYears(): number {
    return this.props.minYears;
  }

  get level(): ExperienceLevel {
    return this.props.level;
  }

  static create(minYears: number, level: ExperienceLevel): ExperienceRequirement {
    if (minYears < 0 || minYears > MAX_YEARS) {
      throw new Error(`Minimum years of experience must be between 0 and ${MAX_YEARS}`);
    }

    return new ExperienceRequirement({ minYears, level });
  }
}
