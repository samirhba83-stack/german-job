export class UnauthorizedApplicationActionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedApplicationActionException';
  }
}
