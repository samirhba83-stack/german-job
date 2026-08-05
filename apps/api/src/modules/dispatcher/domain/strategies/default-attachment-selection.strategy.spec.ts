import { DefaultAttachmentSelectionStrategy } from './default-attachment-selection.strategy';
import { CampaignTarget } from '../../../campaigns/domain/entities/campaign-target.entity';

describe('DefaultAttachmentSelectionStrategy', () => {
  it('selects nothing at zero confidence until a real engine is configured', () => {
    const target = CampaignTarget.create('target-1', 'job-1', 'company-1');

    const result = new DefaultAttachmentSelectionStrategy().selectAttachments(target, 'company-1');

    expect(result.resumeDocumentId).toBeNull();
    expect(result.motivationLetterDocumentId).toBeNull();
    expect(result.certificateDocumentIds).toEqual([]);
    expect(result.portfolioDocumentId).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.explanation).toBeTruthy();
  });
});
