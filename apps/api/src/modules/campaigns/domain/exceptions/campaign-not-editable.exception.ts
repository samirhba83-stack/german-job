import { CampaignStatus } from '@german-job-engine/shared-types';

export class CampaignNotEditableException extends Error {
  constructor(status: CampaignStatus) {
    super(`Campaign cannot be edited while in status ${status}`);
    this.name = 'CampaignNotEditableException';
  }
}
