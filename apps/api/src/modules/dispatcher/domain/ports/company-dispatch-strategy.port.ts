export const COMPANY_DISPATCH_STRATEGY = Symbol('COMPANY_DISPATCH_STRATEGY');

/** Per-company dispatch guidance a future engine could compute from that company's profile/history. */
export interface CompanyDispatchProfile {
  readonly companyId: string;
  readonly preferredSendHourRange: { readonly startHour: number; readonly endHour: number } | null;
  readonly explanation: string;
}

/**
 * Extension point for Milestone 4's "company-aware dispatching" requirement. Resolved per
 * company so a future milestone can vary sending strategy (preferred hours, pacing, channel)
 * by company profile without touching the Dispatcher's core plan-building logic. Provisioned
 * and DI-wired in M4 via DefaultCompanyDispatchStrategy but not yet consumed by
 * CampaignDispatcherService — ExecutionPlan is computed per campaign, not per company, and no
 * milestone has asked for a per-company plan output yet. A future milestone that adds
 * per-target dispatch decisions is the natural first consumer.
 */
export interface CompanyDispatchStrategy {
  resolve(companyId: string): CompanyDispatchProfile;
}
