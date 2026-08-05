import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/execution.module';
import { ExecutionTrackingModule } from '../execution-tracking/execution-tracking.module';
import { BusinessPolicyEnforcementService } from './application/services/business-policy-enforcement.service';
import { POLICY_ENFORCEMENT_STRATEGY } from './domain/ports/policy-enforcement-strategy.port';
import { DeterministicPolicyEnforcementStrategy } from './domain/strategies/deterministic-policy-enforcement.strategy';
import { POLICY_SPECIFICATIONS, PolicySpecification } from './domain/ports/policy-specification.port';
import { SUBSCRIPTION_ELIGIBILITY_POLICY, SubscriptionEligibilitySpecification } from './domain/specifications/subscription-eligibility.specification';
import { EXECUTION_QUOTA_POLICY, ExecutionQuotaSpecification } from './domain/specifications/execution-quota.specification';
import { CAMPAIGN_STATUS_POLICY, CampaignStatusSpecification } from './domain/specifications/campaign-status.specification';
import { ACCOUNT_STATUS_POLICY, AccountStatusSpecification } from './domain/specifications/account-status.specification';
import { CANDIDATE_COMPLETENESS_POLICY, CandidateCompletenessSpecification } from './domain/specifications/candidate-completeness.specification';
import { COMPANY_ELIGIBILITY_POLICY, CompanyEligibilitySpecification } from './domain/specifications/company-eligibility.specification';
import { ATTACHMENT_VALIDATION_POLICY, AttachmentValidationSpecification } from './domain/specifications/attachment-validation.specification';
import { PROVIDER_RESTRICTION_POLICY, ProviderRestrictionSpecification } from './domain/specifications/provider-restriction.specification';
import { COMPLIANCE_POLICY, ComplianceSpecification } from './domain/specifications/compliance.specification';
import { RATE_LIMIT_POLICY, RateLimitSpecification } from './domain/specifications/rate-limit.specification';
import { SECURITY_RESTRICTION_POLICY, SecurityRestrictionSpecification } from './domain/specifications/security-restriction.specification';

/**
 * Business Policy Enforcement Engine scaffold (M15). Not imported into
 * AppModule — same rule as every Phase 4 module before it. Imports only
 * ExecutionModule for the shared clock port; unlike every other Phase 4
 * module, it depends on no other bounded context at all — the engine only
 * evaluates the PolicyEvaluationContext it is given, it never fetches
 * anything itself. Each of the 11 policies is bound to its own token so any
 * one of them can be replaced via DI without touching the others.
 */
@Module({
  imports: [ExecutionModule, ExecutionTrackingModule],
  providers: [
    BusinessPolicyEnforcementService,
    { provide: SUBSCRIPTION_ELIGIBILITY_POLICY, useClass: SubscriptionEligibilitySpecification },
    { provide: EXECUTION_QUOTA_POLICY, useClass: ExecutionQuotaSpecification },
    { provide: CAMPAIGN_STATUS_POLICY, useClass: CampaignStatusSpecification },
    { provide: ACCOUNT_STATUS_POLICY, useClass: AccountStatusSpecification },
    { provide: CANDIDATE_COMPLETENESS_POLICY, useClass: CandidateCompletenessSpecification },
    { provide: COMPANY_ELIGIBILITY_POLICY, useClass: CompanyEligibilitySpecification },
    { provide: ATTACHMENT_VALIDATION_POLICY, useClass: AttachmentValidationSpecification },
    { provide: PROVIDER_RESTRICTION_POLICY, useClass: ProviderRestrictionSpecification },
    { provide: COMPLIANCE_POLICY, useClass: ComplianceSpecification },
    { provide: RATE_LIMIT_POLICY, useClass: RateLimitSpecification },
    { provide: SECURITY_RESTRICTION_POLICY, useClass: SecurityRestrictionSpecification },
    { provide: POLICY_ENFORCEMENT_STRATEGY, useClass: DeterministicPolicyEnforcementStrategy },
    {
      provide: POLICY_SPECIFICATIONS,
      useFactory: (...policies: PolicySpecification[]): PolicySpecification[] => policies,
      inject: [
        SUBSCRIPTION_ELIGIBILITY_POLICY,
        EXECUTION_QUOTA_POLICY,
        CAMPAIGN_STATUS_POLICY,
        ACCOUNT_STATUS_POLICY,
        CANDIDATE_COMPLETENESS_POLICY,
        COMPANY_ELIGIBILITY_POLICY,
        ATTACHMENT_VALIDATION_POLICY,
        PROVIDER_RESTRICTION_POLICY,
        COMPLIANCE_POLICY,
        RATE_LIMIT_POLICY,
        SECURITY_RESTRICTION_POLICY,
      ],
    },
  ],
  exports: [BusinessPolicyEnforcementService],
})
export class BusinessPolicyEnforcementModule {}
