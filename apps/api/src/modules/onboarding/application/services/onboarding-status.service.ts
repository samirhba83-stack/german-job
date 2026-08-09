import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_REPOSITORY, UserRepository } from '../../../users/domain/repositories/user.repository.interface';
import { USER_PROFILE_REPOSITORY, UserProfileRepository } from '../../../profiles/domain/repositories/user-profile.repository.interface';
import { CONNECTED_MAILBOX_REPOSITORY, ConnectedMailboxRepository } from '../../../connected-mailbox/domain/ports/connected-mailbox.repository';
import { CAMPAIGN_REPOSITORY, CampaignRepository } from '../../../campaigns/domain/repositories/campaign.repository.interface';

export type OnboardingStepState = 'complete' | 'incomplete' | 'unavailable';

export interface OnboardingStep {
  readonly id: string;
  readonly label: string;
  readonly state: OnboardingStepState;
  readonly detail: string;
}

export interface OnboardingStatus {
  readonly userId: string;
  readonly accountCreatedAt: Date;
  readonly steps: OnboardingStep[];
  readonly profileCompletionPercentage: number;
  /** M31 Phase 20/21/26 — restated here, not just in marketing copy, because this is the one
   * non-negotiable business rule every beta user must see before they act: nothing in this
   * product ever reaches a real company without a separate, explicit approval this build cannot
   * grant itself. */
  readonly productionSafetyNotice: string;
}

/**
 * M31 Phase 21 — Beta Onboarding. A pure read-side aggregator over 4 existing bounded contexts
 * (users/profiles/connected-mailbox/campaigns), same shape as `application-assembly`'s own
 * cross-context service (that module's own doc comment is the precedent this follows): no new
 * domain entity, no new persistence — every field here is a real, live read of state another
 * module already owns.
 *
 * Deliberately reports 3 states, not 2 (`complete`/`incomplete`), for the mailbox step:
 * `unavailable` means the step cannot be completed in this deployment at all (no real Google/
 * Microsoft OAuth credentials configured — see docs/production-certification/07/08 checklists),
 * which is categorically different from `incomplete` ("you haven't done it yet, but you could
 * right now") — collapsing the two would be exactly the kind of fake-progress-or-hidden-failure
 * this milestone's own instructions forbid.
 */
@Injectable()
export class OnboardingStatusService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_PROFILE_REPOSITORY) private readonly profiles: UserProfileRepository,
    @Inject(CONNECTED_MAILBOX_REPOSITORY) private readonly mailboxes: ConnectedMailboxRepository,
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository,
    private readonly config: ConfigService,
  ) {}

  async getStatus(userId: string): Promise<OnboardingStatus> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [profile, mailbox, ownedCampaigns] = await Promise.all([
      this.profiles.findByUserId(userId),
      this.mailboxes.findActiveByUserId(userId),
      this.campaigns.findByOwnerId(userId),
    ]);

    const profileCompletionPercentage = profile ? profile.calculateCompletionPercentage() : 0;

    const steps: OnboardingStep[] = [
      {
        id: 'account',
        label: 'Create your account',
        state: 'complete',
        detail: `Account created ${user.createdAt.toISOString()}.`,
      },
      this.buildProfileStep(profile !== null, profileCompletionPercentage),
      this.buildMailboxStep(mailbox !== null),
      {
        id: 'campaign',
        label: 'Create your first campaign',
        state: ownedCampaigns.length > 0 ? 'complete' : 'incomplete',
        detail:
          ownedCampaigns.length > 0
            ? `${ownedCampaigns.length} campaign${ownedCampaigns.length === 1 ? '' : 's'} created.`
            : 'Create a campaign to start defining what roles and companies you want to target.',
      },
    ];

    return {
      userId,
      accountCreatedAt: user.createdAt,
      steps,
      profileCompletionPercentage,
      productionSafetyNotice:
        'German Job Engine is running in a Controlled Closed Beta. No application is ever sent ' +
        'to a real company without separate, explicit Product Owner approval activating real ' +
        'company outreach — everything you do in this beta is safe to explore.',
    };
  }

  private buildProfileStep(hasProfile: boolean, completionPercentage: number): OnboardingStep {
    if (!hasProfile) {
      return {
        id: 'profile',
        label: 'Complete your profile',
        state: 'incomplete',
        detail: 'Create your candidate profile to get started.',
      };
    }
    // A CV is required before any real application can ever be assembled (application-assembly
    // reads it as one of its two source-of-truth document candidates) — profile completion alone
    // isn't enough to call this step done.
    return {
      id: 'profile',
      label: 'Complete your profile',
      state: completionPercentage >= 100 ? 'complete' : 'incomplete',
      detail: `${completionPercentage}% of your profile is filled in.`,
    };
  }

  private buildMailboxStep(hasConnectedMailbox: boolean): OnboardingStep {
    const googleConfigured = Boolean(this.config.get<string>('connectedMailbox.google.clientId'));
    const microsoftConfigured = Boolean(this.config.get<string>('connectedMailbox.microsoft.clientId'));
    const encryptionConfigured = Boolean(this.config.get<string>('connectedMailbox.tokenEncryption.key'));

    if (!encryptionConfigured || (!googleConfigured && !microsoftConfigured)) {
      return {
        id: 'connect-mailbox',
        label: 'Connect your Gmail or Outlook mailbox',
        state: 'unavailable',
        detail:
          'Mailbox connection is not available in this environment yet — real Google/Microsoft ' +
          'OAuth credentials have not been configured. This is not something you can fix; it is ' +
          'tracked in the production certification checklist.',
      };
    }

    return {
      id: 'connect-mailbox',
      label: 'Connect your Gmail or Outlook mailbox',
      state: hasConnectedMailbox ? 'complete' : 'incomplete',
      detail: hasConnectedMailbox
        ? 'A mailbox is connected — applications send from your own address.'
        : 'Connect a mailbox so applications can be sent from your own address.',
    };
  }
}
