export class NoTaskSelectedException extends Error {
  constructor(campaignId: string, reasonCode: string) {
    super(`No task was selected for campaign "${campaignId}" (reason: ${reasonCode}); nothing to execute.`);
    this.name = 'NoTaskSelectedException';
  }
}
