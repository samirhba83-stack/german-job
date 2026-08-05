import { Injectable } from '@nestjs/common';
import { BillingEntitlementProjectionService } from '../../../billing/application/services/billing-entitlement-projection.service';
import { EmailProviderGatewayService } from '../../../email-provider/application/services/email-provider-gateway.service';
import { PolicyEvaluationContext } from '../../../business-policy-enforcement/domain/models/policy-evaluation-context';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { Company } from '../../../companies/domain/entities/company.entity';
import { ApplicationPackage } from '../../../application-assembly/domain/models/application-package';

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/**
 * Assembles the one input BusinessPolicyEnforcementService needs (M15's engine holds no
 * repository of its own by design — see its module doc comment) from real data sources this
 * module has access to. Every field is either a genuine read of real persisted data, or — where
 * the underlying concept has no real backing anywhere in the domain yet (account suspension, a
 * recipient-domain blocklist, a candidate opt-out registry) — the single honestly-derivable
 * default documented inline. None of these are fabricated data; they are documented
 * interpretations of "no such concept exists yet," matching this project's established pattern
 * for CampaignDto.health/.intelligence (M23).
 *
 * M27: subscription/plan data now comes from BillingEntitlementProjectionService — the one
 * centralized entitlement authority — rather than reading SUBSCRIPTION_REPOSITORY and a
 * hardcoded "ACTIVE implies allowed" rule directly. `canStartNewExecution` already correctly
 * accounts for plan entitlement (CAN_PRODUCTION_EXECUTE), grace-period-vs-past-due, and
 * cancel-at-period-end policy — this builder only maps that one real answer onto the existing
 * PolicyEvaluationContext shape, without touching SubscriptionEligibilitySpecification itself.
 */
@Injectable()
export class CampaignPolicyContextBuilder {
  constructor(
    private readonly entitlementProjection: BillingEntitlementProjectionService,
    private readonly providerGateway: EmailProviderGatewayService,
  ) {}

  async build(params: {
    executionId: string;
    correlationId: string;
    campaign: Campaign;
    company: Company;
    hasCv: boolean;
    pkg: ApplicationPackage;
    now: Date;
  }): Promise<PolicyEvaluationContext> {
    const { executionId, correlationId, campaign, company, hasCv, pkg, now } = params;

    // No `status` concept exists on the real User model (no suspension/lock mechanism anywhere
    // in this codebase today) — every real user is, by construction, the only value that can
    // exist: ACTIVE. Documented default, not a fabricated read.
    const account = { status: 'ACTIVE' as const };

    const entitlements = await this.entitlementProjection.getEntitlementSummary(campaign.ownerId, now);
    // Maps the one real answer (canStartNewExecution) onto SubscriptionEligibilitySpecification's
    // existing, unmodified, already-tested {status, planAllowsAutomatedSending} shape — a
    // past-due (but not yet expired-grace) subscription is reported as PAST_DUE here specifically
    // so it denies new execution while the Billing Workspace can still show the real plan/grace
    // details via BillingEntitlementProjectionService directly.
    const subscriptionContext = {
      status: entitlements.canStartNewExecution ? ('ACTIVE' as const) : entitlements.isPastDue ? ('PAST_DUE' as const) : ('CANCELLED' as const),
      planAllowsAutomatedSending: entitlements.canStartNewExecution,
    };

    const dispatchedInLast24h = campaign.dispatchedInLast24Hours(now);

    const totalAttachmentBytes = pkg.attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);

    const providerAvailable = await this.providerGateway.checkAvailability();
    const capabilities = this.providerGateway.getCapabilities();

    return {
      executionId,
      correlationId,
      subscription: subscriptionContext,
      // No plan-level quota concept distinct from the campaign's own rate-limit profile exists
      // yet — reusing the same real numbers rather than inventing a second, parallel quota axis.
      quota: { used: dispatchedInLast24h, limit: campaign.rateLimitProfile.maxPerDay },
      campaign: { status: this.mapCampaignStatus(campaign) },
      account,
      candidate: { hasCv, hasRecipientEmail: Boolean(company.contact.contactEmail) },
      company: { isActive: company.status === 'ACTIVE', isBlocklisted: false },
      attachments: { totalSizeBytes: totalAttachmentBytes, maxAllowedSizeBytes: MAX_ATTACHMENT_BYTES },
      provider: { providerAvailable, providerSupportsRequiredCapabilities: capabilities.supportsAttachments || pkg.attachments.length === 0 },
      // No opt-out registry or recipient-domain blocklist exists anywhere in the domain yet.
      compliance: { candidateHasOptedOut: false, recipientDomainIsAllowed: true },
      rateLimit: { sentInCurrentWindow: dispatchedInLast24h, windowLimit: campaign.rateLimitProfile.maxPerDay },
      // Reached only from the internal tick driver / lifecycle event listener, never from a raw
      // inbound HTTP request — true by construction of the call path, not an assumption.
      security: { requestIsAuthenticated: true, originIsTrusted: true },
    };
  }

  private mapCampaignStatus(campaign: Campaign): 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' {
    switch (campaign.status) {
      case 'DRAFT':
      case 'READY':
        return 'DRAFT';
      case 'RUNNING':
      case 'RESUMING':
        return 'ACTIVE';
      case 'PAUSED':
      case 'COOLING_DOWN':
        return 'PAUSED';
      case 'COMPLETED':
        return 'COMPLETED';
      default:
        return 'ARCHIVED';
    }
  }
}
