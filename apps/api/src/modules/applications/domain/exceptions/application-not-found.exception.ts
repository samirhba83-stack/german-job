export class ApplicationNotFoundException extends Error {
  constructor(applicationId: string) {
    super(`Application not found: ${applicationId}`);
    this.name = 'ApplicationNotFoundException';
  }
}
