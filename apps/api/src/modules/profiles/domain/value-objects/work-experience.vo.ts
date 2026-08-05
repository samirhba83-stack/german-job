import { ValueObject } from '../../../../shared/domain';
import { InvalidDateRangeException } from '../exceptions/invalid-date-range.exception';

interface WorkExperienceProps {
  company: string;
  title: string;
  startDate: Date;
  endDate: Date | null;
  description: string | null;
}

export class WorkExperience extends ValueObject<WorkExperienceProps> {
  private constructor(props: WorkExperienceProps) {
    super(props);
  }

  get company(): string {
    return this.props.company;
  }

  get title(): string {
    return this.props.title;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date | null {
    return this.props.endDate;
  }

  get description(): string | null {
    return this.props.description;
  }

  static create(props: {
    company: string;
    title: string;
    startDate: Date;
    endDate?: Date | null;
    description?: string | null;
  }): WorkExperience {
    const company = props.company.trim();
    const title = props.title.trim();

    if (!company) {
      throw new Error('Work experience requires a company name');
    }
    if (!title) {
      throw new Error('Work experience requires a job title');
    }
    if (props.endDate && props.endDate < props.startDate) {
      throw new InvalidDateRangeException('Work experience end date cannot be before its start date');
    }

    return new WorkExperience({
      company,
      title,
      startDate: props.startDate,
      endDate: props.endDate ?? null,
      description: props.description?.trim() || null,
    });
  }
}
