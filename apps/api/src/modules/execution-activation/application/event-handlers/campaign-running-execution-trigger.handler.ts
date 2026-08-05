import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CampaignStatus } from '@german-job-engine/shared-types';
import { CampaignTransitioned } from '../../../campaigns/domain/events/campaign-transitioned.event';
import { CampaignExecutionEntryPointService } from '../services/campaign-execution-entry-point.service';

/**
 * M26 Phase 3 — connects campaign lifecycle transitions to real execution without the Campaigns
 * module ever depending on this one (avoiding the circular import that would create). Every
 * lifecycle handler (start/pause/resume/cancel/complete/archive) already publishes
 * CampaignTransitioned via the existing local CQRS EventBus — before M26 nothing subscribed to
 * it (confirmed in the architecture audit). This is that first real subscriber: whenever a
 * transition's new state is RUNNING (a real Start, or a real Resume/confirmResume), it calls the
 * one authoritative entry point immediately, fire-and-forget, so a candidate doesn't have to wait
 * up to a full tick interval to see their campaign start moving.
 *
 * Fire-and-forget is intentional, not sloppy: StartCampaignHandler's own HTTP response must
 * return as soon as the real status transition is persisted ("Starting must not imply that
 * delivery already occurred" — M26 Phase 3) — it must not block on a full execution attempt. Any
 * error here is caught and logged, never rethrown into the EventBus's own dispatch, and the
 * regular tick driver remains the reliability backstop if this immediate kick fails for any
 * reason (lock contention, transient error, process restart mid-flight).
 */
@EventsHandler(CampaignTransitioned)
export class CampaignRunningExecutionTriggerHandler implements IEventHandler<CampaignTransitioned> {
  private readonly logger = new Logger(CampaignRunningExecutionTriggerHandler.name);

  constructor(private readonly entryPoint: CampaignExecutionEntryPointService) {}

  handle(event: CampaignTransitioned): void {
    if (event.currentState !== CampaignStatus.RUNNING) {
      return;
    }

    this.entryPoint.activate(event.campaignId).catch((error: unknown) => {
      this.logger.warn(
        `Immediate activation kick failed for campaign ${event.campaignId}; the tick driver will retry: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }
}
