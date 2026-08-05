export class ProfileAlreadyExistsException extends Error {
  constructor(userId: string) {
    super(`A profile already exists for user: ${userId}`);
    this.name = 'ProfileAlreadyExistsException';
  }
}
