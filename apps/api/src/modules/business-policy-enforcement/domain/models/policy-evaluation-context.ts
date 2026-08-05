/**
 * The engine's sole input. A plain, self-contained snapshot — this module
 * imports no other bounded context; whichever future caller invokes the
 * engine (Worker, Execution Runtime, ...) is responsible for assembling it
 * from Campaign/Subscription/Company/ApplicationPackage/etc. This keeps the
 * engine free of any repository or infrastructure dependency whatsoever,
 * matching "must never access infrastructure" literally.
 */
export interface SubscriptionContext {
  readonly status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIAL';
  readonly planAllowsAutomatedSending: boolean;
}

export interface QuotaContext {
  readonly used: number;
  readonly limit: number;
}

export interface CampaignContext {
  readonly status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
}

export interface AccountContext {
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
}

export interface CandidateCompletenessContext {
  readonly hasCv: boolean;
  readonly hasRecipientEmail: boolean;
}

export interface CompanyEligibilityContext {
  readonly isActive: boolean;
  readonly isBlocklisted: boolean;
}

export interface AttachmentContext {
  readonly totalSizeBytes: number;
  readonly maxAllowedSizeBytes: number;
}

export interface ProviderRestrictionContext {
  readonly providerAvailable: boolean;
  readonly providerSupportsRequiredCapabilities: boolean;
}

export interface ComplianceContext {
  readonly candidateHasOptedOut: boolean;
  readonly recipientDomainIsAllowed: boolean;
}

export interface RateLimitContext {
  readonly sentInCurrentWindow: number;
  readonly windowLimit: number;
}

export interface SecurityContext {
  readonly requestIsAuthenticated: boolean;
  readonly originIsTrusted: boolean;
}

export interface PolicyEvaluationContext {
  readonly executionId: string;
  /** Supplied by the caller when it has one (M18) — this module is not yet wired into the main
   * correlated pipeline (see BusinessPolicyEnforcementService), so this is honestly optional
   * rather than pretending a value always flows in from upstream. */
  readonly correlationId?: string | null;
  readonly subscription: SubscriptionContext;
  readonly quota: QuotaContext;
  readonly campaign: CampaignContext;
  readonly account: AccountContext;
  readonly candidate: CandidateCompletenessContext;
  readonly company: CompanyEligibilityContext;
  readonly attachments: AttachmentContext;
  readonly provider: ProviderRestrictionContext;
  readonly compliance: ComplianceContext;
  readonly rateLimit: RateLimitContext;
  readonly security: SecurityContext;
}
