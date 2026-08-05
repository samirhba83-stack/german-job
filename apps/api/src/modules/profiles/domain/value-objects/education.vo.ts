import { ValueObject } from '../../../../shared/domain';
import { InvalidDateRangeException } from '../exceptions/invalid-date-range.exception';

interface EducationProps {
  institution: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: Date;
  endDate: Date | null;
}

export class Education extends ValueObject<EducationProps> {
  private constructor(props: EducationProps) {
    super(props);
  }

  get institution(): string {
    return this.props.institution;
  }

  get degree(): string {
    return this.props.degree;
  }

  get fieldOfStudy(): string | null {
    return this.props.fieldOfStudy;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date | null {
    return this.props.endDate;
  }

  static create(props: {
    institution: string;
    degree: string;
    fieldOfStudy?: string | null;
    startDate: Date;
    endDate?: Date | null;
  }): Education {
    const institution = props.institution.trim();
    const degree = props.degree.trim();

    if (!institution) {
      throw new Error('Education requires an institution name');
    }
    if (!degree) {
      throw new Error('Education requires a degree');
    }
    if (props.endDate && props.endDate < props.startDate) {
      throw new InvalidDateRangeException('Education end date cannot be before its start date');
    }

    return new Education({
      institution,
      degree,
      fieldOfStudy: props.fieldOfStudy?.trim() || null,
      startDate: props.startDate,
      endDate: props.endDate ?? null,
    });
  }
}
