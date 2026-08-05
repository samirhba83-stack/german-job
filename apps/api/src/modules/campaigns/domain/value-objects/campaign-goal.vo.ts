import { CampaignOutcomeGoal } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';
import { InvalidCampaignGoalException } from '../exceptions/invalid-campaign-goal.exception';

interface CampaignGoalProps {
  targetApplicationCount: number;
  desiredOutcome: CampaignOutcomeGoal;
  deadline: Date | null;
}

/** Replaceable mid-flight via Campaign.adjustGoal() — goals are dynamic by construction. */
export class CampaignGoal extends ValueObject<CampaignGoalProps> {
  private constructor(props: CampaignGoalProps) {
    super(props);
  }

  get targetApplicationCount(): number {
    return this.props.targetApplicationCount;
  }

  get desiredOutcome(): CampaignOutcomeGoal {
    return this.props.desiredOutcome;
  }

  get deadline(): Date | null {
    return this.props.deadline;
  }

  static create(props: {
    targetApplicationCount: number;
    desiredOutcome: CampaignOutcomeGoal;
    deadline?: Date | null;
  }): CampaignGoal {
    if (!Number.isInteger(props.targetApplicationCount) || props.targetApplicationCount < 1) {
      throw new InvalidCampaignGoalException('targetApplicationCount must be a positive integer');
    }
    return new CampaignGoal({
      targetApplicationCount: props.targetApplicationCount,
      desiredOutcome: props.desiredOutcome,
      deadline: props.deadline ?? null,
    });
  }
}
