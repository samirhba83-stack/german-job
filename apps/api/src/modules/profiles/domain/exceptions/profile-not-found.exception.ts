export class ProfileNotFoundException extends Error {
  constructor(userId: string) {
    super(`Profile not found for user: ${userId}`);
    this.name = 'ProfileNotFoundException';
  }
}
