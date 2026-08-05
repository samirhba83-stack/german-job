import { DispatchOutcome } from '@german-job-engine/shared-types';
import { Entity } from '../../../../shared/domain';
import { EvidenceReference } from '../value-objects/evidence-reference.vo';

export interface DispatchAttemptProps {
  attemptNumber: number;
  attemptedAt: Date;
  outcome: DispatchOutcome;
  failureReason: string | null;
  evidenceReference: EvidenceReference | null;
}

/** One recorded attempt to move a CampaignTarget forward — the substrate for exact retry/replay. */
export class DispatchAttempt extends Entity<string> {
  private props: DispatchAttemptProps;

  private constructor(id: string, props: DispatchAttemptProps) {
    super(id);
    this.props = props;
  }

  get attemptNumber(): number {
    return this.props.attemptNumber;
  }

  get attemptedAt(): Date {
    return this.props.attemptedAt;
  }

  get outcome(): DispatchOutcome {
    return this.props.outcome;
  }

  get failureReason(): string | null {
    return this.props.failureReason;
  }

  get evidenceReference(): EvidenceReference | null {
    return this.props.evidenceReference;
  }

  static create(id: string, props: DispatchAttemptProps): DispatchAttempt {
    return new DispatchAttempt(id, props);
  }
}
