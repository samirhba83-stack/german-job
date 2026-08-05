import { CampaignStatus } from '@german-job-engine/shared-types';
import { Actor } from '../value-objects/actor.vo';

export interface PolicyDecision {
  allowed: boolean;
  reasonCode: string;
  explanation: string;
}

export function allow(reasonCode = 'ALLOWED'): PolicyDecision {
  return { allowed: true, reasonCode, explanation: 'Allowed.' };
}

export function deny(reasonCode: string, explanation: string): PolicyDecision {
  return { allowed: false, reasonCode, explanation };
}

export interface CampaignLifecycleContext {
  actor: Actor;
  ownerId: string;
  currentState: CampaignStatus;
  targetState: CampaignStatus;
}

/** Governs a Campaign lifecycle transition. Invoked inside the aggregate's own transition methods. */
export interface CampaignLifecyclePolicy {
  authorize(context: CampaignLifecycleContext): PolicyDecision;
}
