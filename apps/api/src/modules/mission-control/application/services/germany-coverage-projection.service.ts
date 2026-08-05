import { Injectable } from '@nestjs/common';
import { ExecutionEventQueryService } from '../../../execution-tracking/application/services/execution-event-query.service';
import { GermanyCoverageSnapshot } from '../../domain/models/germany-coverage-snapshot';
import { tallyTaskExecutionsByCampaign } from '../../domain/services/campaign-task-tally';

const DEFAULT_LIMIT = 1000;
const NOTE =
  'Geographic coverage requires company/region data not present in the execution event schema. ' +
  'This snapshot is a campaign-level proxy computed from TASK_EXECUTED events; true German-city ' +
  'coverage awaits a future milestone that threads geographic metadata into recorded events.';

/** Germany Coverage Analytics (M17) — see GermanyCoverageSnapshot's doc comment for the honest scope of this projection. */
@Injectable()
export class GermanyCoverageProjectionService {
  constructor(private readonly eventQuery: ExecutionEventQueryService) {}

  async getCoverage(limit: number = DEFAULT_LIMIT): Promise<GermanyCoverageSnapshot> {
    const events = await this.eventQuery.findByEventType('TASK_EXECUTED', limit);
    const tallies = tallyTaskExecutionsByCampaign(events);

    const totalCampaignsObserved = tallies.length;
    const campaignsFullySucceeding = tallies.filter((tally) => tally.tasksFailed === 0 && tally.tasksSucceeded > 0).length;
    const campaignsWithAnyFailure = tallies.filter((tally) => tally.tasksFailed > 0).length;

    const totalTasks = tallies.reduce((sum, tally) => sum + tally.tasksExecuted, 0);
    const totalSucceeded = tallies.reduce((sum, tally) => sum + tally.tasksSucceeded, 0);

    return {
      totalCampaignsObserved,
      campaignsFullySucceeding,
      campaignsWithAnyFailure,
      campaignCoveragePercentage: totalTasks > 0 ? Math.round((totalSucceeded / totalTasks) * 100) : 0,
      note: NOTE,
    };
  }
}
