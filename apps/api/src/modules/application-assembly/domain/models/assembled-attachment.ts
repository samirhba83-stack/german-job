export type AttachmentCategory = 'CV' | 'MOTIVATION_LETTER' | 'CERTIFICATE';

/**
 * Shaped to map 1:1 onto email-provider's EmailAttachmentSpec (fileName,
 * mimeType, sizeBytes, contentReference) plus a category kept for
 * explainability — the eventual translation into EmailAttachmentSpec is a
 * straight field copy with category dropped.
 */
export interface AssembledAttachment {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentReference: string;
  readonly category: AttachmentCategory;
}
