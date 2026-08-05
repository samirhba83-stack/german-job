/** Describes an attachment without carrying its binary content — the raw bytes are a storage/
 * infrastructure concern outside this abstraction; a reference id is all the contract needs. */
export interface EmailAttachmentSpec {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentReference: string;
}
