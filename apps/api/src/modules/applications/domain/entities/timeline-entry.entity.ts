import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { Entity } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { ApplicationChannel } from '../value-objects/application-channel.vo';
import { TransitionReason } from '../value-objects/transition-reason.vo';
import { Metadata } from '../value-objects/metadata.vo';
import { CorrelationId } from '../value-objects/correlation-id.vo';
import { EvidenceReference } from '../value-objects/evidence-reference.vo';
import { ConfidenceScore } from '../value-objects/confidence-score.vo';

export interface TimelineEntryProps {
  timestamp: Date;
  actor: Actor;
  source: ApplicationChannel;
  reason: TransitionReason | null;
  previousState: ApplicationLifecycleStatus | null;
  currentState: ApplicationLifecycleStatus;
  metadata: Metadata;
  correlationId: CorrelationId;
  evidenceReference: EvidenceReference | null;
  confidence: ConfidenceScore | null;
}

/**
 * One immutable record of one transition. Has its own identity because two entries can
 * otherwise be structurally identical (same states, same second) and must still be
 * distinguishable and orderable — the reason this is an Entity, not a Value Object.
 */
export class TimelineEntry extends Entity<string> {
  private props: TimelineEntryProps;

  private constructor(id: string, props: TimelineEntryProps) {
    super(id);
    this.props = props;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get actor(): Actor {
    return this.props.actor;
  }

  get source(): ApplicationChannel {
    return this.props.source;
  }

  get reason(): TransitionReason | null {
    return this.props.reason;
  }

  get previousState(): ApplicationLifecycleStatus | null {
    return this.props.previousState;
  }

  get currentState(): ApplicationLifecycleStatus {
    return this.props.currentState;
  }

  get metadata(): Metadata {
    return this.props.metadata;
  }

  get correlationId(): CorrelationId {
    return this.props.correlationId;
  }

  get evidenceReference(): EvidenceReference | null {
    return this.props.evidenceReference;
  }

  get confidence(): ConfidenceScore | null {
    return this.props.confidence;
  }

  static create(id: string, props: TimelineEntryProps): TimelineEntry {
    return new TimelineEntry(id, props);
  }
}
