import { CampaignStatus, CampaignStrategyType } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface CampaignSearchSpecificationProps {
  ownerId: string | null;
  status: CampaignStatus | null;
  strategyType: CampaignStrategyType | null;
  createdFrom: Date | null;
  createdTo: Date | null;
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Normalizes and clamps the filter/pagination criteria for Campaign search and listing. */
export class CampaignSearchSpecification extends ValueObject<CampaignSearchSpecificationProps> {
  private constructor(props: CampaignSearchSpecificationProps) {
    super(props);
  }

  get ownerId(): string | null {
    return this.props.ownerId;
  }

  get status(): CampaignStatus | null {
    return this.props.status;
  }

  get strategyType(): CampaignStrategyType | null {
    return this.props.strategyType;
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
    ownerId?: string | null;
    status?: CampaignStatus | null;
    strategyType?: CampaignStrategyType | null;
    createdFrom?: Date | null;
    createdTo?: Date | null;
    page?: number;
    limit?: number;
  }): CampaignSearchSpecification {
    const page = Math.max(1, Math.trunc(params.page ?? DEFAULT_PAGE));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(params.limit ?? DEFAULT_LIMIT)));

    return new CampaignSearchSpecification({
      ownerId: params.ownerId ?? null,
      status: params.status ?? null,
      strategyType: params.strategyType ?? null,
      createdFrom: params.createdFrom ?? null,
      createdTo: params.createdTo ?? null,
      page,
      limit,
    });
  }
}
