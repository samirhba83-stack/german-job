export class CandidateUserNotFoundException extends Error {
  constructor(userId: string) {
    super(`No user found with id "${userId}"`);
    this.name = 'CandidateUserNotFoundException';
  }
}
