import { CampaignTarget } from '../../../campaigns/domain/entities/campaign-target.entity';
import { AttachmentSelectionResult, AttachmentSelectionStrategy } from '../ports/attachment-selection-strategy.port';

/** Neutral default: selects nothing, at zero confidence, until a real selection engine is wired in. */
export class DefaultAttachmentSelectionStrategy implements AttachmentSelectionStrategy {
  selectAttachments(_target: CampaignTarget, _companyId: string): AttachmentSelectionResult {
    return {
      resumeDocumentId: null,
      motivationLetterDocumentId: null,
      certificateDocumentIds: [],
      portfolioDocumentId: null,
      confidence: 0,
      explanation: 'No attachment-selection engine is configured yet; a future AI module will populate this via a different DI binding.',
    };
  }
}
