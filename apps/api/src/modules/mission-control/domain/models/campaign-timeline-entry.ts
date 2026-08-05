import { ExecutionEventStatus, ExecutionEventType } from '../../../execution-tracking/domain/models/execution-event-type';
import { BusinessContext } from '../../../execution-tracking/domain/models/business-context';

/** One entry in a campaign's chronological execution history — a direct projection of ExecutionEvent. */
export interface CampaignTimelineEntry {
  readonly timestamp: Date;
  readonly eventType: ExecutionEventType;
  readonly executionId: string | null;
  readonly campaignId: string | null;
  readonly correlationId: string;
  readonly traceId: string;
  readonly explanation: string;
  readonly status: ExecutionEventStatus;
  readonly metadata: Readonly<Record<string, string>>;
  readonly businessContext: BusinessContext;
}
