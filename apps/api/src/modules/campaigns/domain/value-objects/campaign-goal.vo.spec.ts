import { CampaignOutcomeGoal } from '@german-job-engine/shared-types';
import { CampaignGoal } from './campaign-goal.vo';
import { InvalidCampaignGoalException } from '../exceptions/invalid-campaign-goal.exception';

describe('CampaignGoal', () => {
  it('accepts a positive integer target count', () => {
    const goal = CampaignGoal.create({ targetApplicationCount: 10, desiredOutcome: CampaignOutcomeGoal.INTERVIEWS });
    expect(goal.targetApplicationCount).toBe(10);
    expect(goal.deadline).toBeNull();
  });

  it('rejects a zero or negative target count', () => {
    expect(() => CampaignGoal.create({ targetApplicationCount: 0, desiredOutcome: CampaignOutcomeGoal.REPLIES })).toThrow(
      InvalidCampaignGoalException,
    );
  });

  it('rejects a non-integer target count', () => {
    expect(() => CampaignGoal.create({ targetApplicationCount: 2.5, desiredOutcome: CampaignOutcomeGoal.REPLIES })).toThrow(
      InvalidCampaignGoalException,
    );
  });
});
