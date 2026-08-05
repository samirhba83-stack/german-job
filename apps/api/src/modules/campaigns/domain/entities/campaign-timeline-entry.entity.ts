import { CampaignStatus } from '@german-job-engine/shared-types';
import { Entity } from '../../../../shared/domain';
import { Actor } from '../value-objects/actor.vo';
import { CampaignReason } from '../value-objects/campaign-reason.vo';
import { Metadata } from '../value-objects/metadata.vo';
import { CorrelationId } from '../value-objects/correlation-id.vo';
import { EvidenceReference } from '../value-objects/evidence-reference.vo';

export interface CampaignTimelineEntryProps {
  timestamp: Date;
  actor: Actor;
  source: string;
  reason: CampaignReason | null;
  previousState: CampaignStatus | null;
  currentState: CampaignStatus;
  metadata: Metadata;
  correlationId: CorrelationId;
  evidenceReference: EvidenceReference | null;
  aiExplanation: string | null;
}

/** One immutable record of one transition — has its own identity so entries stay orderable. */
export class CampaignTimelineEntry extends Entity<string> {
  private props: CampaignTimelineEntryProps;

  private constructor(id: string, props: CampaignTimelineEntryProps) {
    super(id);
    this.props = props;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get actor(): Actor {
    return this.props.actor;
  }

  get source(): string {
    return this.props.source;
  }

  get reason(): CampaignReason | null {
    return this.props.reason;
  }

  get previousState(): CampaignStatus | null {
    return this.props.previousState;
  }

  get currentState(): CampaignStatus {
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

  get aiExplanation(): string | null {
    return this.props.aiExplanation;
  }

  static create(id: string, props: CampaignTimelineEntryProps): CampaignTimelineEntry {
    return new CampaignTimelineEntry(id, props);
  }
}
