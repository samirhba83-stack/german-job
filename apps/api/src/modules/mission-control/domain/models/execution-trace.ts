import { ExecutionEventStatus, ExecutionEventType } from '../../../execution-tracking/domain/models/execution-event-type';
import { GeographicContext } from '../../../execution-tracking/domain/models/geographic-context';

export interface ExecutionTraceEvent {
  readonly eventType: ExecutionEventType;
  readonly timestamp: Date;
  readonly status: ExecutionEventStatus;
  readonly explanation: string;
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Everything the event log actually knows about one execution, queried by
 * traceId (M18) rather than the legacy executionId — traceId now also
 * catches PROVIDER_SELECTED, which shares a task's traceId even though it
 * never carried that task's executionId (see ProviderSelectionEngineService
 * / EmailDeliveryExecutionService). POLICY_EVALUATED and
 * APPLICATION_PACKAGE_ASSEMBLED still use their own independent ids and are
 * NOT part of this trace — those two services are not wired into the main
 * pipeline yet, so selectedCv/selectedMotivationLetter/selectedAttachments
 * genuinely cannot be joined to a specific task execution today. workerId,
 * providerId, and geography come straight from businessContext — no
 * re-parsing of metadata strings needed for those three. hasEvents
 * distinguishes "no events for this id" from "events exist but say nothing
 * about delivery".
 */
export interface ExecutionTrace {
  readonly traceId: string;
  readonly hasEvents: boolean;
  readonly events: ReadonlyArray<ExecutionTraceEvent>;
  readonly selectedProviderId: string | null;
  readonly deliveryStatus: string | null;
  readonly durationMs: number | null;
  readonly overallStatus: ExecutionEventStatus | null;
  readonly workerId: string | null;
  readonly geography: GeographicContext | null;
}
