import { TrendDirection } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';
import { Probability } from './probability.vo';

interface CampaignHealthProps {
  healthScore: Probability | null;
  riskScore: Probability | null;
  progressScore: Probability | null;
  successTrend: TrendDirection | null;
  replyTrend: TrendDirection | null;
  performanceTrend: TrendDirection | null;
  computedBy: string;
  computedAt: Date;
}

/**
 * Fully reserved — even progressScore, though trivial arithmetic, is deliberately not computed
 * by this domain in Phase 1/2. Attached only via `recordHealthAssessment()`, which does raise
 * CampaignHealthChanged (unlike Intelligence, which stays silent).
 */
export class CampaignHealth extends ValueObject<CampaignHealthProps> {
  private constructor(props: CampaignHealthProps) {
    super(props);
  }

  get healthScore(): Probability | null {
    return this.props.healthScore;
  }
  get riskScore(): Probability | null {
    return this.props.riskScore;
  }
  get progressScore(): Probability | null {
    return this.props.progressScore;
  }
  get successTrend(): TrendDirection | null {
    return this.props.successTrend;
  }
  get replyTrend(): TrendDirection | null {
    return this.props.replyTrend;
  }
  get performanceTrend(): TrendDirection | null {
    return this.props.performanceTrend;
  }
  get computedBy(): string {
    return this.props.computedBy;
  }
  get computedAt(): Date {
    return this.props.computedAt;
  }

  static create(props: {
    healthScore?: Probability | null;
    riskScore?: Probability | null;
    progressScore?: Probability | null;
    successTrend?: TrendDirection | null;
    replyTrend?: TrendDirection | null;
    performanceTrend?: TrendDirection | null;
    computedBy: string;
    computedAt?: Date;
  }): CampaignHealth {
    const computedBy = props.computedBy.trim();
    if (!computedBy) {
      throw new Error('A health assessment must identify which engine computed it');
    }
    return new CampaignHealth({
      healthScore: props.healthScore ?? null,
      riskScore: props.riskScore ?? null,
      progressScore: props.progressScore ?? null,
      successTrend: props.successTrend ?? null,
      replyTrend: props.replyTrend ?? null,
      performanceTrend: props.performanceTrend ?? null,
      computedBy,
      computedAt: props.computedAt ?? new Date(),
    });
  }
}
