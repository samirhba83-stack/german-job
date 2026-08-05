import { CampaignStatus } from '@german-job-engine/shared-types';
import type { BadgeTone } from '@/components/ui/badge';

export type MissionStatus =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'paused'
  | 'waiting'
  | 'recovering'
  | 'attention-required'
  | 'cancelled'
  | 'completed';

export interface MissionStatusDescriptor {
  status: MissionStatus;
  label: string;
  tone: BadgeTone;
  explanation: string;
  recommendedAction: string | null;
  /** Real `CampaignHealth.healthScore` (0..1), sourced from `GET /campaigns/:id` or
   * `GET /campaigns/:id/health` — both real, live endpoints. `null` whenever the caller has no
   * health context (no page in this milestone fetches one yet — the Campaign Workspace that
   * would is M23 scope, docs/interaction-framework/14-risks-and-future-expansion.md) or the
   * backend hasn't computed an assessment for this campaign. Never estimated or interpolated. */
  confidence: number | null;
  /** Real ISO timestamp: `CampaignHealth.computedAt` when a health assessment exists, otherwise
   * the campaign's own `updatedAt`. Never defaults to "now" — a caller with no timestamp gets
   * `null`, not a fabricated one. */
  lastUpdateTime: string | null;
}

export interface MissionStatusContext {
  health?: { healthScore: number | null; computedAt: string } | null;
  updatedAt?: string;
}

/**
 * docs/interaction-framework/05-mission-status.md — every state derived from the real, live
 * CampaignStatus enum (docs/frontend-architecture §1.5); never a fabricated pipeline-internal
 * state. This is a relabeling of real backend state into human operational language, not a new
 * source of truth — CampaignStatus itself remains authoritative everywhere else in the product
 * (Badge, filters, API calls all still use the real enum).
 */
const DESCRIPTORS: Record<MissionStatus, Omit<MissionStatusDescriptor, 'status' | 'confidence' | 'lastUpdateTime'>> = {
  idle: {
    label: 'Idle',
    tone: 'neutral',
    explanation: 'This campaign is a draft and has not been started yet.',
    recommendedAction: 'Review your campaign settings, then start it when ready.',
  },
  preparing: {
    label: 'Preparing',
    tone: 'info',
    explanation: 'This campaign is ready to run but has not been started yet.',
    recommendedAction: 'Start the campaign to begin working toward its goal.',
  },
  running: {
    label: 'Running',
    tone: 'positive',
    explanation: 'This campaign is active.',
    recommendedAction: null,
  },
  paused: {
    label: 'Paused',
    tone: 'warning',
    explanation: 'This campaign is paused and will not progress until resumed.',
    recommendedAction: 'Resume the campaign when you’re ready to continue.',
  },
  waiting: {
    label: 'Waiting',
    tone: 'warning',
    explanation: 'This campaign is cooling down between active batches.',
    recommendedAction: null,
  },
  recovering: {
    label: 'Recovering',
    tone: 'info',
    explanation: 'This campaign is resuming after a pause or cooldown.',
    recommendedAction: null,
  },
  'attention-required': {
    label: 'Attention required',
    tone: 'critical',
    explanation: 'This campaign stopped before reaching its goal.',
    recommendedAction: 'Review what happened, then retry or replay eligible targets.',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'neutral',
    explanation: 'This campaign was cancelled and will not resume.',
    recommendedAction: 'Start a new campaign if you still want to reach this goal.',
  },
  completed: {
    label: 'Completed',
    tone: 'positive',
    explanation: 'This campaign reached its goal.',
    recommendedAction: 'Review the results, or start a new campaign.',
  },
};

const CAMPAIGN_STATUS_TO_MISSION_STATUS: Record<CampaignStatus, MissionStatus> = {
  [CampaignStatus.DRAFT]: 'idle',
  [CampaignStatus.READY]: 'preparing',
  [CampaignStatus.RUNNING]: 'running',
  [CampaignStatus.PAUSED]: 'paused',
  [CampaignStatus.COOLING_DOWN]: 'waiting',
  [CampaignStatus.RESUMING]: 'recovering',
  [CampaignStatus.COMPLETED]: 'completed',
  [CampaignStatus.STOPPED]: 'attention-required',
  [CampaignStatus.CANCELLED]: 'cancelled',
  [CampaignStatus.ARCHIVED]: 'idle',
};

export function getMissionStatus(campaignStatus: CampaignStatus, context?: MissionStatusContext): MissionStatusDescriptor {
  const status = CAMPAIGN_STATUS_TO_MISSION_STATUS[campaignStatus];
  const health = context?.health ?? null;
  return {
    status,
    ...DESCRIPTORS[status],
    confidence: health?.healthScore ?? null,
    lastUpdateTime: health?.computedAt ?? context?.updatedAt ?? null,
  };
}
