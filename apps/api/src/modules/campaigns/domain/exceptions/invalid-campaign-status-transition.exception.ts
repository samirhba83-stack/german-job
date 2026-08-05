import { CampaignStatus } from '@german-job-engine/shared-types';

export class InvalidCampaignStatusTransitionException extends Error {
  constructor(from: CampaignStatus, to: CampaignStatus) {
    super(`Cannot transition a campaign from ${from} to ${to}`);
    this.name = 'InvalidCampaignStatusTransitionException';
  }
}
