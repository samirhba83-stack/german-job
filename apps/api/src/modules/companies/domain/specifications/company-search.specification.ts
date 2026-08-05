import { CompanyIndustry, CompanySize, VisaSponsorship } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface CompanySearchSpecificationProps {
  keyword: string | null;
  industry: CompanyIndustry | null;
  size: CompanySize | null;
  city: string | null;
  visaSponsorship: VisaSponsorship | null;
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Encapsulates and normalizes the filter/pagination criteria for company search. */
export class CompanySearchSpecification extends ValueObject<CompanySearchSpecificationProps> {
  private constructor(props: CompanySearchSpecificationProps) {
    super(props);
  }

  get keyword(): string | null {
    return this.props.keyword;
  }

  get industry(): CompanyIndustry | null {
    return this.props.industry;
  }

  get size(): CompanySize | null {
    return this.props.size;
  }

  get city(): string | null {
    return this.props.city;
  }

  get visaSponsorship(): VisaSponsorship | null {
    return this.props.visaSponsorship;
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
    industry?: CompanyIndustry | null;
    size?: CompanySize | null;
    city?: string | null;
    visaSponsorship?: VisaSponsorship | null;
    page?: number;
    limit?: number;
  }): CompanySearchSpecification {
    const page = Math.max(1, Math.trunc(params.page ?? DEFAULT_PAGE));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(params.limit ?? DEFAULT_LIMIT)));

    return new CompanySearchSpecification({
      keyword: params.keyword?.trim() || null,
      industry: params.industry ?? null,
      size: params.size ?? null,
      city: params.city?.trim() || null,
      visaSponsorship: params.visaSponsorship ?? null,
      page,
      limit,
    });
  }
}
