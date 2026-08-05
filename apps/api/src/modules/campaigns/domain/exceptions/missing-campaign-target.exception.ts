export class MissingCampaignTargetException extends Error {
  constructor() {
    super('A campaign must have at least one target before it can be marked ready');
    this.name = 'MissingCampaignTargetException';
  }
}
