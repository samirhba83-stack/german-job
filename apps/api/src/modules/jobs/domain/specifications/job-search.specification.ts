import {
  JobStatus,
  EmploymentType,
  ContractType,
  RemotePolicy,
  VisaSponsorship,
  GermanLevel,
  CompanyIndustry,
} from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface JobSearchSpecificationProps {
  keyword: string | null;
  city: string | null;
  companyId: string | null;
  industry: CompanyIndustry | null;
  minSalary: number | null;
  employmentType: EmploymentType | null;
  contractType: ContractType | null;
  remotePolicy: RemotePolicy | null;
  visaSponsorship: VisaSponsorship | null;
  ausbildungOnly: boolean | null;
  germanLevel: GermanLevel | null;
  status: JobStatus | null;
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Encapsulates and normalizes the filter/pagination criteria for job search and listing. */
export class JobSearchSpecification extends ValueObject<JobSearchSpecificationProps> {
  private constructor(props: JobSearchSpecificationProps) {
    super(props);
  }

  get keyword(): string | null {
    return this.props.keyword;
  }

  get city(): string | null {
    return this.props.city;
  }

  get companyId(): string | null {
    return this.props.companyId;
  }

  get industry(): CompanyIndustry | null {
    return this.props.industry;
  }

  get minSalary(): number | null {
    return this.props.minSalary;
  }

  get employmentType(): EmploymentType | null {
    return this.props.employmentType;
  }

  get contractType(): ContractType | null {
    return this.props.contractType;
  }

  get remotePolicy(): RemotePolicy | null {
    return this.props.remotePolicy;
  }

  get visaSponsorship(): VisaSponsorship | null {
    return this.props.visaSponsorship;
  }

  get ausbildungOnly(): boolean | null {
    return this.props.ausbildungOnly;
  }

  get germanLevel(): GermanLevel | null {
    return this.props.germanLevel;
  }

  get status(): JobStatus {
    return this.props.status ?? JobStatus.PUBLISHED;
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
    keyword?: string | null;
    city?: string | null;
    companyId?: string | null;
    industry?: CompanyIndustry | null;
    minSalary?: number | null;
    employmentType?: EmploymentType | null;
    contractType?: ContractType | null;
    remotePolicy?: RemotePolicy | null;
    visaSponsorship?: VisaSponsorship | null;
    ausbildungOnly?: boolean | null;
    germanLevel?: GermanLevel | null;
    status?: JobStatus | null;
    page?: number;
    limit?: number;
  }): JobSearchSpecification {
    const page = Math.max(1, Math.trunc(params.page ?? DEFAULT_PAGE));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(params.limit ?? DEFAULT_LIMIT)));

    return new JobSearchSpecification({
      keyword: params.keyword?.trim() || null,
      city: params.city?.trim() || null,
      companyId: params.companyId ?? null,
      industry: params.industry ?? null,
      minSalary: params.minSalary ?? null,
      employmentType: params.employmentType ?? null,
      contractType: params.contractType ?? null,
      remotePolicy: params.remotePolicy ?? null,
      visaSponsorship: params.visaSponsorship ?? null,
      ausbildungOnly: params.ausbildungOnly ?? null,
      germanLevel: params.germanLevel ?? null,
      status: params.status ?? null,
      page,
      limit,
    });
  }
}
