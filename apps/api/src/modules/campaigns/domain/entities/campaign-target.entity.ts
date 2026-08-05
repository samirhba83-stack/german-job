import { CampaignTargetStatus } from '@german-job-engine/shared-types';
import { Entity } from '../../../../shared/domain';
import { SmartResumeSelection } from '../value-objects/smart-resume-selection.vo';
import { SmartMotivationLetterSelection } from '../value-objects/smart-motivation-letter-selection.vo';
import { DispatchAttempt } from './dispatch-attempt.entity';

export interface CampaignTargetProps {
  jobId: string;
  companyId: string;
  status: CampaignTargetStatus;
  resumeSelection: SmartResumeSelection | null;
  motivationLetterSelection: SmartMotivationLetterSelection | null;
  dispatchAttempts: DispatchAttempt[];
  addedAt: Date;
  updatedAt: Date;
}

/**
 * One job/company pairing the campaign intends to apply to. Owns its own micro-lifecycle,
 * mutated exclusively through the Campaign aggregate root — never addressed directly.
 */
export class CampaignTarget extends Entity<string> {
  private props: CampaignTargetProps;

  private constructor(id: string, props: CampaignTargetProps) {
    super(id);
    this.props = props;
  }

  get jobId(): string {
    return this.props.jobId;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get status(): CampaignTargetStatus {
    return this.props.status;
  }

  get resumeSelection(): SmartResumeSelection | null {
    return this.props.resumeSelection;
  }

  get motivationLetterSelection(): SmartMotivationLetterSelection | null {
    return this.props.motivationLetterSelection;
  }

  get dispatchAttempts(): ReadonlyArray<DispatchAttempt> {
    return this.props.dispatchAttempts;
  }

  get addedAt(): Date {
    return this.props.addedAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  static create(id: string, jobId: string, companyId: string, now: Date = new Date()): CampaignTarget {
    return new CampaignTarget(id, {
      jobId,
      companyId,
      status: CampaignTargetStatus.PENDING,
      resumeSelection: null,
      motivationLetterSelection: null,
      dispatchAttempts: [],
      addedAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: CampaignTargetProps): CampaignTarget {
    return new CampaignTarget(id, props);
  }

  assignResumeSelection(selection: SmartResumeSelection): void {
    this.props.resumeSelection = selection;
    this.touch();
  }

  assignMotivationLetterSelection(selection: SmartMotivationLetterSelection): void {
    this.props.motivationLetterSelection = selection;
    this.touch();
  }

  markQueued(now: Date = new Date()): void {
    this.props.status = CampaignTargetStatus.QUEUED;
    this.props.updatedAt = now;
  }

  markDispatched(attempt: DispatchAttempt, now: Date = new Date()): void {
    this.props.status = CampaignTargetStatus.DISPATCHED;
    this.props.dispatchAttempts = [...this.props.dispatchAttempts, attempt];
    this.props.updatedAt = now;
  }

  markSkipped(now: Date = new Date()): void {
    this.props.status = CampaignTargetStatus.SKIPPED;
    this.props.updatedAt = now;
  }

  recordFailedAttempt(attempt: DispatchAttempt, now: Date = new Date()): void {
    this.props.dispatchAttempts = [...this.props.dispatchAttempts, attempt];
    this.props.updatedAt = now;
  }

  markFailed(now: Date = new Date()): void {
    this.props.status = CampaignTargetStatus.FAILED;
    this.props.updatedAt = now;
  }

  markExcluded(now: Date = new Date()): void {
    this.props.status = CampaignTargetStatus.EXCLUDED;
    this.props.updatedAt = now;
  }

  resetForRetry(now: Date = new Date()): void {
    this.props.status = CampaignTargetStatus.PENDING;
    this.props.updatedAt = now;
  }

  private touch(now: Date = new Date()): void {
    this.props.updatedAt = now;
  }
}
