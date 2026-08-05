export class TargetJobNotFoundException extends Error {
  constructor(jobId: string) {
    super(`No target job found with id "${jobId}"`);
    this.name = 'TargetJobNotFoundException';
  }
}
