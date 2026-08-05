export class JobClosedException extends Error {
  constructor(jobId: string) {
    super(`Job is closed and cannot be edited without administrator override: ${jobId}`);
    this.name = 'JobClosedException';
  }
}
