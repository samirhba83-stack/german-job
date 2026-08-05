import { AttachmentReferenceContext, AttachmentResolutionResult } from '../models/resolved-attachment';

export const ATTACHMENT_RESOLVER_PORT = Symbol('ATTACHMENT_RESOLVER_PORT');

/**
 * M28.5 Phase 3 — the ONE authoritative resolver. No controller, worker, or provider adapter is
 * permitted to read storage directly (Non-Negotiable boundary) — every real attachment byte this
 * application ever sends flows through exactly this method, which performs, in order: ownership
 * verification, application-scope verification, active-version verification, checksum
 * verification, MIME/size policy validation, scan-status verification, then returns a bounded
 * payload. On any failure it returns an explainable `AttachmentResolutionFailure` rather than
 * throwing — matching this codebase's established "explainable failure over exception for a
 * routine business outcome" doctrine (`ProviderFailure`, `DeliveryStatus`).
 */
export interface AttachmentResolverPort {
  resolve(references: ReadonlyArray<AttachmentReferenceContext>): Promise<AttachmentResolutionResult>;
}
