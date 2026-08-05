import { CampaignTarget } from '../../../campaigns/domain/entities/campaign-target.entity';

export const ATTACHMENT_SELECTION_STRATEGY = Symbol('ATTACHMENT_SELECTION_STRATEGY');

export interface AttachmentSelectionResult {
  readonly resumeDocumentId: string | null;
  readonly motivationLetterDocumentId: string | null;
  readonly certificateDocumentIds: ReadonlyArray<string>;
  readonly portfolioDocumentId: string | null;
  readonly confidence: number;
  readonly explanation: string;
}

/**
 * Extension point for Milestone 4's "Attachment Strategy" requirement: a future AI module
 * selects which CV, certificates, motivation letter, and portfolio best fit a given target's
 * company. `CampaignTarget` already carries `resumeSelection`/`motivationLetterSelection` slots
 * (assigned via `assignResumeSelection()`/`assignMotivationLetterSelection()`, reserved since
 * Phase 4 M1) — this port is what a future milestone's selection engine implements to produce
 * the values those methods expect. Provisioned and DI-wired here but not yet invoked by
 * CampaignDispatcherService, which computes campaign-level plans, not per-target selections.
 */
export interface AttachmentSelectionStrategy {
  selectAttachments(target: CampaignTarget, companyId: string): AttachmentSelectionResult;
}
