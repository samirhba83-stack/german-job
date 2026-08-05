export class JobNotFoundException extends Error {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`);
    this.name = 'JobNotFoundException';
  }
}
