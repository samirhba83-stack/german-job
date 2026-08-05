import { ApplicationLifecycleStatus, ApplicationChannelType } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface ApplicationSearchSpecificationProps {
  candidateId: string | null;
  jobId: string | null;
  companyId: string | null;
  status: ApplicationLifecycleStatus | null;
  channelType: ApplicationChannelType | null;
  createdFrom: Date | null;
  createdTo: Date | null;
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Normalizes and clamps the filter/pagination criteria for Application search and listing. */
export class ApplicationSearchSpecification extends ValueObject<ApplicationSearchSpecificationProps> {
  private constructor(props: ApplicationSearchSpecificationProps) {
    super(props);
  }

  get candidateId(): string | null {
    return this.props.candidateId;
  }

  get jobId(): string | null {
    return this.props.jobId;
  }

  get companyId(): string | null {
    return this.props.companyId;
  }

  get status(): ApplicationLifecycleStatus | null {
    return this.props.status;
  }

  get channelType(): ApplicationChannelType | null {
    return this.props.channelType;
  }

  get createdFrom(): Date | null {
    return this.props.createdFrom;
  }

  get createdTo(): Date | null {
    return this.props.createdTo;
  }

  get page(): number {
    return this.props.page;
  }

  get limit(): number {
    return this.props.limit;
  }

  get offset(): number {
    return (this.props.page - 1) * this.props.limit;
  }

  static create(params: {
    candidateId?: string | null;
    jobId?: string | null;
    companyId?: string | null;
    status?: ApplicationLifecycleStatus | null;
    channelType?: ApplicationChannelType | null;
    createdFrom?: Date | null;
    createdTo?: Date | null;
    page?: number;
    limit?: number;
  }): ApplicationSearchSpecification {
    const page = Math.max(1, Math.trunc(params.page ?? DEFAULT_PAGE));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(params.limit ?? DEFAULT_LIMIT)));

    return new ApplicationSearchSpecification({
      candidateId: params.candidateId ?? null,
      jobId: params.jobId ?? null,
      companyId: params.companyId ?? null,
      status: params.status ?? null,
      channelType: params.channelType ?? null,
      createdFrom: params.createdFrom ?? null,
      createdTo: params.createdTo ?? null,
      page,
      limit,
    });
  }
}
