import { Injectable } from '@nestjs/common';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { CampaignProgress } from '../../domain/models/campaign-progress';
import { tallyTaskExecutionsByCampaign } from '../../domain/services/campaign-task-tally';

const DEFAULT_LIMIT = 1000;

/** Regional Intelligence (M17) — see CampaignProgress's doc comment for why this groups by campaign, not by German region. */
@Injectable()
export class RegionalProgressProjectionService {
  constructor(private readonly eventQuery: ExecutionEventQueryService) {}

  async getProgress(limit: number = DEFAULT_LIMIT): Promise<CampaignProgress[]> {
    const events = await this.eventQuery.findByEventType('TASK_EXECUTED', limit);
    const tallies = tallyTaskExecutionsByCampaign(events);

    return tallies.map((tally) => ({
      campaignId: tally.campaignId,
      region: null,
      tasksExecuted: tally.tasksExecuted,
      tasksSucceeded: tally.tasksSucceeded,
      tasksFailed: tally.tasksFailed,
      completionPercentage: tally.tasksExecuted > 0 ? Math.round((tally.tasksSucceeded / tally.tasksExecuted) * 100) : 0,
      lastActivityAt: tally.lastActivityAt,
    }));
  }
}
