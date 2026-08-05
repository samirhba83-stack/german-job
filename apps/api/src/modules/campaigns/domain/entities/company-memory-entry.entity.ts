import { Entity } from '../../../../shared/domain';
import { Probability } from '../value-objects/probability.vo';

export interface CompanyMemoryEntryProps {
  companyId: string;
  alreadyApplied: boolean;
  alreadyContacted: boolean;
  coolingDownUntil: Date | null;
  previousReplyAt: Date | null;
  interviewCount: number;
  offerCount: number;
  historicalSuccessScore: Probability | null;
  futureAiNotes: string | null;
  lastInteractionAt: Date | null;
  updatedAt: Date;
}

/**
 * One company's history within this campaign — the mechanism that makes duplicate detection
 * and fatigue protection possible without this domain querying the Companies/Applications modules.
 */
export class CompanyMemoryEntry extends Entity<string> {
  private props: CompanyMemoryEntryProps;

  private constructor(id: string, props: CompanyMemoryEntryProps) {
    super(id);
    this.props = props;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get alreadyApplied(): boolean {
    return this.props.alreadyApplied;
  }

  get alreadyContacted(): boolean {
    return this.props.alreadyContacted;
  }

  get coolingDownUntil(): Date | null {
    return this.props.coolingDownUntil;
  }

  get previousReplyAt(): Date | null {
    return this.props.previousReplyAt;
  }

  get interviewCount(): number {
    return this.props.interviewCount;
  }

  get offerCount(): number {
    return this.props.offerCount;
  }

  get historicalSuccessScore(): Probability | null {
    return this.props.historicalSuccessScore;
  }

  get futureAiNotes(): string | null {
    return this.props.futureAiNotes;
  }

  get lastInteractionAt(): Date | null {
    return this.props.lastInteractionAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isInCooldown(referenceDate: Date = new Date()): boolean {
    return this.props.coolingDownUntil !== null && referenceDate < this.props.coolingDownUntil;
  }

  static createEmpty(companyId: string, now: Date = new Date()): CompanyMemoryEntry {
    return new CompanyMemoryEntry(companyId, {
      companyId,
      alreadyApplied: false,
      alreadyContacted: false,
      coolingDownUntil: null,
      previousReplyAt: null,
      interviewCount: 0,
      offerCount: 0,
      historicalSuccessScore: null,
      futureAiNotes: null,
      lastInteractionAt: null,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: CompanyMemoryEntryProps): CompanyMemoryEntry {
    return new CompanyMemoryEntry(id, props);
  }

  recordInteraction(
    updates: Partial<
      Pick<
        CompanyMemoryEntryProps,
        | 'alreadyApplied'
        | 'alreadyContacted'
        | 'coolingDownUntil'
        | 'previousReplyAt'
        | 'interviewCount'
        | 'offerCount'
        | 'historicalSuccessScore'
        | 'futureAiNotes'
      >
    >,
    now: Date = new Date(),
  ): void {
    this.props = { ...this.props, ...updates, lastInteractionAt: now, updatedAt: now };
  }
}
