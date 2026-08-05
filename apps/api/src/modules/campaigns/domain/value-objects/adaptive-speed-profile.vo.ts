import { ValueObject } from '../../../../shared/domain';

interface AdaptiveSpeedProfileProps {
  replyRateFactor: number | null;
  bounceRateFactor: number | null;
  timeOfDayFactor: number | null;
  weekdayFactor: number | null;
  germanHolidayFactor: number | null;
  companyWorkingHoursFactor: number | null;
  campaignHealthFactor: number | null;
  companyFatigueFactor: number | null;
  userReputationFactor: number | null;
  riskScoreFactor: number | null;
  computedBy: string;
  computedAt: Date;
}

/**
 * Reserved architecture only — ten named, nullable factor slots. Nothing in the domain reads
 * these to change batch sizing or timing; attached only via `recordAdaptiveSpeedAssessment()`.
 */
export class AdaptiveSpeedProfile extends ValueObject<AdaptiveSpeedProfileProps> {
  private constructor(props: AdaptiveSpeedProfileProps) {
    super(props);
  }

  get replyRateFactor(): number | null {
    return this.props.replyRateFactor;
  }
  get bounceRateFactor(): number | null {
    return this.props.bounceRateFactor;
  }
  get timeOfDayFactor(): number | null {
    return this.props.timeOfDayFactor;
  }
  get weekdayFactor(): number | null {
    return this.props.weekdayFactor;
  }
  get germanHolidayFactor(): number | null {
    return this.props.germanHolidayFactor;
  }
  get companyWorkingHoursFactor(): number | null {
    return this.props.companyWorkingHoursFactor;
  }
  get campaignHealthFactor(): number | null {
    return this.props.campaignHealthFactor;
  }
  get companyFatigueFactor(): number | null {
    return this.props.companyFatigueFactor;
  }
  get userReputationFactor(): number | null {
    return this.props.userReputationFactor;
  }
  get riskScoreFactor(): number | null {
    return this.props.riskScoreFactor;
  }
  get computedBy(): string {
    return this.props.computedBy;
  }
  get computedAt(): Date {
    return this.props.computedAt;
  }

  static create(props: {
    replyRateFactor?: number | null;
    bounceRateFactor?: number | null;
    timeOfDayFactor?: number | null;
    weekdayFactor?: number | null;
    germanHolidayFactor?: number | null;
    companyWorkingHoursFactor?: number | null;
    campaignHealthFactor?: number | null;
    companyFatigueFactor?: number | null;
    userReputationFactor?: number | null;
    riskScoreFactor?: number | null;
    computedBy: string;
    computedAt?: Date;
  }): AdaptiveSpeedProfile {
    const computedBy = props.computedBy.trim();
    if (!computedBy) {
      throw new Error('An adaptive speed assessment must identify which engine computed it');
    }
    return new AdaptiveSpeedProfile({
      replyRateFactor: props.replyRateFactor ?? null,
      bounceRateFactor: props.bounceRateFactor ?? null,
      timeOfDayFactor: props.timeOfDayFactor ?? null,
      weekdayFactor: props.weekdayFactor ?? null,
      germanHolidayFactor: props.germanHolidayFactor ?? null,
      companyWorkingHoursFactor: props.companyWorkingHoursFactor ?? null,
      campaignHealthFactor: props.campaignHealthFactor ?? null,
      companyFatigueFactor: props.companyFatigueFactor ?? null,
      userReputationFactor: props.userReputationFactor ?? null,
      riskScoreFactor: props.riskScoreFactor ?? null,
      computedBy,
      computedAt: props.computedAt ?? new Date(),
    });
  }
}
