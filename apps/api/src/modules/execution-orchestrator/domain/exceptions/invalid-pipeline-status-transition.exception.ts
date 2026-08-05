import { PipelineStatus } from '../entities/execution-task-pipeline.entity';

export class InvalidPipelineStatusTransitionException extends Error {
  constructor(campaignId: string, from: PipelineStatus, to: PipelineStatus) {
    super(`Cannot transition execution pipeline for campaign "${campaignId}" from ${from} to ${to}`);
    this.name = 'InvalidPipelineStatusTransitionException';
  }
}
