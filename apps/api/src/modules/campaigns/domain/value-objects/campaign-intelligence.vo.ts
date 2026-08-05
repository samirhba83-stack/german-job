import { ValueObject } from '../../../../shared/domain';
import { Probability } from './probability.vo';
import { SmartResumeSelection } from './smart-resume-selection.vo';
import { SmartMotivationLetterSelection } from './smart-motivation-letter-selection.vo';

interface CampaignIntelligenceProps {
  bestSendTime: string | null;
  bestBatchSize: number | null;
  bestCompanyOrder: ReadonlyArray<string> | null;
  bestResumeSelection: SmartResumeSelection | null;
  bestMotivationLetterSelection: SmartMotivationLetterSelection | null;
  replyPrediction: Probability | null;
  interviewPrediction: Probability | null;
  offerPrediction: Probability | null;
  contractPrediction: Probability | null;
  riskPrediction: Probability | null;
  decisionExplanation: string | null;
  recommendationExplanation: string | null;
  computedBy: string;
  computedAt: Date;
}

/**
 * Reserved architecture only — every field is nullable and nothing in this codebase computes
 * them. Attached only via `recordIntelligenceAssessment()`, never set by any transition method,
 * and — mirroring the Application Lifecycle Engine's precedent — raises no domain event.
 */
export class CampaignIntelligence extends ValueObject<CampaignIntelligenceProps> {
  private constructor(props: CampaignIntelligenceProps) {
    super(props);
  }

  get bestSendTime(): string | null {
    return this.props.bestSendTime;
  }
  get bestBatchSize(): number | null {
    return this.props.bestBatchSize;
  }
  get bestCompanyOrder(): ReadonlyArray<string> | null {
    return this.props.bestCompanyOrder;
  }
  get bestResumeSelection(): SmartResumeSelection | null {
    return this.props.bestResumeSelection;
  }
  get bestMotivationLetterSelection(): SmartMotivationLetterSelection | null {
    return this.props.bestMotivationLetterSelection;
  }
  get replyPrediction(): Probability | null {
    return this.props.replyPrediction;
  }
  get interviewPrediction(): Probability | null {
    return this.props.interviewPrediction;
  }
  get offerPrediction(): Probability | null {
    return this.props.offerPrediction;
  }
  get contractPrediction(): Probability | null {
    return this.props.contractPrediction;
  }
  get riskPrediction(): Probability | null {
    return this.props.riskPrediction;
  }
  get decisionExplanation(): string | null {
    return this.props.decisionExplanation;
  }
  get recommendationExplanation(): string | null {
    return this.props.recommendationExplanation;
  }
  get computedBy(): string {
    return this.props.computedBy;
  }
  get computedAt(): Date {
    return this.props.computedAt;
  }

  static create(props: {
    bestSendTime?: string | null;
    bestBatchSize?: number | null;
    bestCompanyOrder?: string[] | null;
    bestResumeSelection?: SmartResumeSelection | null;
    bestMotivationLetterSelection?: SmartMotivationLetterSelection | null;
    replyPrediction?: Probability | null;
    interviewPrediction?: Probability | null;
    offerPrediction?: Probability | null;
    contractPrediction?: Probability | null;
    riskPrediction?: Probability | null;
    decisionExplanation?: string | null;
    recommendationExplanation?: string | null;
    computedBy: string;
    computedAt?: Date;
  }): CampaignIntelligence {
    const computedBy = props.computedBy.trim();
    if (!computedBy) {
      throw new Error('An intelligence assessment must identify which engine computed it');
    }
    return new CampaignIntelligence({
      bestSendTime: props.bestSendTime ?? null,
      bestBatchSize: props.bestBatchSize ?? null,
      bestCompanyOrder: props.bestCompanyOrder ?? null,
      bestResumeSelection: props.bestResumeSelection ?? null,
      bestMotivationLetterSelection: props.bestMotivationLetterSelection ?? null,
      replyPrediction: props.replyPrediction ?? null,
      interviewPrediction: props.interviewPrediction ?? null,
      offerPrediction: props.offerPrediction ?? null,
      contractPrediction: props.contractPrediction ?? null,
      riskPrediction: props.riskPrediction ?? null,
      decisionExplanation: props.decisionExplanation ?? null,
      recommendationExplanation: props.recommendationExplanation ?? null,
      computedBy,
      computedAt: props.computedAt ?? new Date(),
    });
  }
}
