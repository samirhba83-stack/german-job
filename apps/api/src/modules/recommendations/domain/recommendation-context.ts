import { AvailabilityStatus, CompanyIndustry, GermanLevel } from '@german-job-engine/shared-types';
import { Campaign } from '../../campaigns/domain/entities/campaign.entity';
import { ExecutionPlan } from '../../dispatcher/domain/execution-plan';

/**
 * A minimal, read-only projection of a candidate's profile — deliberately not the Profiles
 * module's own UserProfile entity. Recommendation strategies are domain-layer code that must
 * not reach into another bounded context's aggregate; RecommendationEngineService (application
 * layer) is the anti-corruption boundary that translates UserProfile into this snapshot.
 */
export interface CandidateProfileSnapshot {
  readonly userId: string;
  readonly germanLevel: GermanLevel | null;
  readonly skillsCount: number;
  readonly hasCv: boolean;
  readonly availabilityStatus: AvailabilityStatus | null;
}

/** Same anti-corruption-layer reasoning as CandidateProfileSnapshot, translated from Company. */
export interface CompanyProfileSnapshot {
  readonly companyId: string;
  readonly industry: CompanyIndustry;
  readonly trustScoreValue: number | null;
  readonly hiringQualityScoreValue: number | null;
}

/**
 * Per-company historical outcome data, sourced from the campaign's own CompanyMemoryEntry
 * records — no new cross-module dependency needed, this data is already modeled (reserved since
 * Phase 4 M1; nothing has read `historicalSuccessScore`/`interviewCount`/`offerCount` until now).
 */
export interface HistoricalOutcomeSnapshot {
  readonly companyId: string;
  readonly alreadyApplied: boolean;
  readonly historicalSuccessScoreValue: number | null;
  readonly interviewCount: number;
  readonly offerCount: number;
}

/**
 * Everything a RecommendationStrategy needs to reason about one campaign: the Dispatcher's own
 * execution plan, the campaign's full state, and enrichment data from outside the Campaigns
 * bounded context (candidate profile, per-company profile, historical outcomes). Assembled by
 * RecommendationEngineService — strategies never fetch anything themselves, keeping every
 * strategy a pure, synchronous, fully-testable function of its input.
 */
export interface RecommendationContext {
  readonly executionPlan: ExecutionPlan;
  readonly campaign: Campaign;
  readonly candidateProfile: CandidateProfileSnapshot | null;
  readonly companyProfiles: ReadonlyMap<string, CompanyProfileSnapshot>;
  readonly historicalOutcomes: ReadonlyMap<string, HistoricalOutcomeSnapshot>;
}
