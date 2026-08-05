import { EducationLevel } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface EducationRequirementProps {
  level: EducationLevel;
  fieldOfStudy: string | null;
  required: boolean;
}

export class EducationRequirement extends ValueObject<EducationRequirementProps> {
  private constructor(props: EducationRequirementProps) {
    super(props);
  }

  get level(): EducationLevel {
    return this.props.level;
  }

  get fieldOfStudy(): string | null {
    return this.props.fieldOfStudy;
  }

  get required(): boolean {
    return this.props.required;
  }

  static create(props: { level: EducationLevel; fieldOfStudy?: string | null; required?: boolean }): EducationRequirement {
    return new EducationRequirement({
      level: props.level,
      fieldOfStudy: props.fieldOfStudy?.trim() || null,
      required: props.required ?? false,
    });
  }
}
