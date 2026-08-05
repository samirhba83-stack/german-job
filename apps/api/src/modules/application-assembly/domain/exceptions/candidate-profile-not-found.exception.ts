export class CandidateProfileNotFoundException extends Error {
  constructor(userId: string) {
    super(`No candidate profile found for user "${userId}"`);
    this.name = 'CandidateProfileNotFoundException';
  }
}
