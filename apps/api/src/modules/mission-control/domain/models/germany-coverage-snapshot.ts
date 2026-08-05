/**
 * "Germany coverage" as the milestone describes it (total companies
 * discovered/processed, regional distribution) requires geographic data
 * that does not exist anywhere in the execution event schema — no
 * ExecutionEvent carries a city/region, and this module is not permitted to
 * read Company/Campaign data directly (Mission Control must consume
 * ExecutionEventQueryService exclusively). This snapshot is therefore an
 * honest campaign-level proxy computed from TASK_EXECUTED events (the one
 * event type carrying both a real campaignId and a real success/failure
 * status), not a geographic coverage figure. note explains this to callers
 * so the gap is visible in the API, not hidden behind a plausible-looking
 * number.
 */
export interface GermanyCoverageSnapshot {
  readonly totalCampaignsObserved: number;
  readonly campaignsFullySucceeding: number;
  readonly campaignsWithAnyFailure: number;
  readonly campaignCoveragePercentage: number;
  readonly note: string;
}
