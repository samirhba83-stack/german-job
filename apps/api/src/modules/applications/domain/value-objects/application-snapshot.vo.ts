import { ValueObject } from '../../../../shared/domain';
import { InvalidApplicationSnapshotException } from '../exceptions/invalid-application-snapshot.exception';

interface ApplicationSnapshotProps {
  jobTitle: string;
  companyName: string;
  jobLocation: string;
  salaryRangeSummary: string | null;
  capturedAt: Date;
}

/**
 * Point-in-time context frozen at submission. Jobs and Companies can change or archive after
 * the fact — the Timeline must stay meaningful even if the referenced Job is later deleted, so
 * this is captured once and never recomputed from the live Job/Company aggregates.
 */
export class ApplicationSnapshot extends ValueObject<ApplicationSnapshotProps> {
  private constructor(props: ApplicationSnapshotProps) {
    super(props);
  }

  get jobTitle(): string {
    return this.props.jobTitle;
  }

  get companyName(): string {
    return this.props.companyName;
  }

  get jobLocation(): string {
    return this.props.jobLocation;
  }

  get salaryRangeSummary(): string | null {
    return this.props.salaryRangeSummary;
  }

  get capturedAt(): Date {
    return this.props.capturedAt;
  }

  static create(props: {
    jobTitle: string;
    companyName: string;
    jobLocation: string;
    salaryRangeSummary?: string | null;
    capturedAt?: Date;
  }): ApplicationSnapshot {
    const jobTitle = props.jobTitle.trim();
    const companyName = props.companyName.trim();
    const jobLocation = props.jobLocation.trim();

    if (!jobTitle) {
      throw new InvalidApplicationSnapshotException('Application snapshot requires a job title');
    }
    if (!companyName) {
      throw new InvalidApplicationSnapshotException('Application snapshot requires a company name');
    }
    if (!jobLocation) {
      throw new InvalidApplicationSnapshotException('Application snapshot requires a job location');
    }

    return new ApplicationSnapshot({
      jobTitle,
      companyName,
      jobLocation,
      salaryRangeSummary: props.salaryRangeSummary?.trim() || null,
      capturedAt: props.capturedAt ?? new Date(),
    });
  }
}
