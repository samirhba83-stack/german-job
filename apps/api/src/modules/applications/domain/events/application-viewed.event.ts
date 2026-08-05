import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { ApplicationLifecycleEvent } from './application-lifecycle.event';
import { Actor } from '../value-objects/actor.vo';
import { EvidenceReference } from '../value-objects/evidence-reference.vo';
import { ConfidenceScore } from '../value-objects/confidence-score.vo';

export class ApplicationViewed extends ApplicationLifecycleEvent {
  constructor(
    applicationId: string,
    correlationId: string,
    previousState: ApplicationLifecycleStatus,
    currentState: ApplicationLifecycleStatus,
    actor: Actor,
    public readonly evidence: EvidenceReference,
    public readonly confidence: ConfidenceScore,
  ) {
    super(applicationId, correlationId, previousState, currentState, actor);
  }
}
