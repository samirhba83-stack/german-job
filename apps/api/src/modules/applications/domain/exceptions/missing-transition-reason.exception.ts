export class MissingTransitionReasonException extends Error {
  constructor(action: string) {
    super(`A transition reason is required to ${action}`);
    this.name = 'MissingTransitionReasonException';
  }
}
