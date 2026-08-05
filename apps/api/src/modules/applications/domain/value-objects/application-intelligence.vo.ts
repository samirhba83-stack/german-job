import { ValueObject } from '../../../../shared/domain';
import { Probability } from './probability.vo';
import { DurationEstimate } from './duration-estimate.vo';
import { ConfidenceScore } from './confidence-score.vo';

interface ApplicationIntelligenceProps {
  replyProbability: Probability | null;
  interviewProbability: Probability | null;
  offerProbability: Probability | null;
  contractProbability: Probability | null;

  expectedTimeToReply: DurationEstimate | null;
  expectedTimeToInterview: DurationEstimate | null;
  expectedTimeToContract: DurationEstimate | null;

  confidenceScore: ConfidenceScore | null;
  historicalSuccessScore: Probability | null;
  riskScore: Probability | null;

  decisionExplanation: string | null;
  recommendationExplanation: string | null;

  computedAt: Date;
  computedBy: string;
}

/**
 * Reserved architecture only — every field is nullable and nothing in this codebase computes
 * them. This value object exists purely so a future Intelligence Engine has somewhere defined
 * to write. Attached to an Application only via `recordIntelligenceAssessment`, never set by
 * any transition method.
 */
export class ApplicationIntelligence extends ValueObject<ApplicationIntelligenceProps> {
  private constructor(props: ApplicationIntelligenceProps) {
    super(props);
  }

  get replyProbability(): Probability | null {
    return this.props.replyProbability;
  }

  get interviewProbability(): Probability | null {
    return this.props.interviewProbability;
  }

  get offerProbability(): Probability | null {
    return this.props.offerProbability;
  }

  get contractProbability(): Probability | null {
    return this.props.contractProbability;
  }

  get expectedTimeToReply(): DurationEstimate | null {
    return this.props.expectedTimeToReply;
  }

  get expectedTimeToInterview(): DurationEstimate | null {
    return this.props.expectedTimeToInterview;
  }

  get expectedTimeToContract(): DurationEstimate | null {
    return this.props.expectedTimeToContract;
  }

  get confidenceScore(): ConfidenceScore | null {
    return this.props.confidenceScore;
  }

  get historicalSuccessScore(): Probability | null {
    return this.props.historicalSuccessScore;
  }

  get riskScore(): Probability | null {
    return this.props.riskScore;
  }

  get decisionExplanation(): string | null {
    return this.props.decisionExplanation;
  }

  get recommendationExplanation(): string | null {
    return this.props.recommendationExplanation;
  }

  get computedAt(): Date {
    return this.props.computedAt;
  }

  get computedBy(): string {
    return this.props.computedBy;
  }

  static create(props: {
    replyProbability?: Probability | null;
    interviewProbability?: Probability | null;
    offerProbability?: Probability | null;
    contractProbability?: Probability | null;
    expectedTimeToReply?: DurationEstimate | null;
    expectedTimeToInterview?: DurationEstimate | null;
    expectedTimeToContract?: DurationEstimate | null;
    confidenceScore?: ConfidenceScore | null;
    historicalSuccessScore?: Probability | null;
    riskScore?: Probability | null;
    decisionExplanation?: string | null;
    recommendationExplanation?: string | null;
    computedBy: string;
    computedAt?: Date;
  }): ApplicationIntelligence {
    const computedBy = props.computedBy.trim();
    if (!computedBy) {
      throw new Error('An intelligence assessment must identify which engine computed it');
    }

    return new ApplicationIntelligence({
      replyProbability: props.replyProbability ?? null,
      interviewProbability: props.interviewProbability ?? null,
      offerProbability: props.offerProbability ?? null,
      contractProbability: props.contractProbability ?? null,
      expectedTimeToReply: props.expectedTimeToReply ?? null,
      expectedTimeToInterview: props.expectedTimeToInterview ?? null,
      expectedTimeToContract: props.expectedTimeToContract ?? null,
      confidenceScore: props.confidenceScore ?? null,
      historicalSuccessScore: props.historicalSuccessScore ?? null,
      riskScore: props.riskScore ?? null,
      decisionExplanation: props.decisionExplanation?.trim() || null,
      recommendationExplanation: props.recommendationExplanation?.trim() || null,
      computedBy,
      computedAt: props.computedAt ?? new Date(),
    });
  }
}
