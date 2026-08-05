import type { JobDto } from '../types';

export async function searchJobs(_keyword: string): Promise<JobDto[]> {
  // TODO: implement — GET /jobs?q= via lib/api-client.
  throw new Error('Not implemented');
}

export async function getJobListing(_id: string): Promise<JobDto> {
  // TODO: implement — GET /jobs/:id via lib/api-client.
  throw new Error('Not implemented');
}
