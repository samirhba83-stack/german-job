/** Domain-level mirrors of the Prisma enums — plain TS unions, matching this codebase's
 * established precedent of never importing `@german-job-engine/database` generated types into a
 * domain layer (see `deliverability`'s `EmailMessageStatus` for the same pattern). */
export type DocumentType = 'CV' | 'MOTIVATION_LETTER' | 'SUPPORTING_DOCUMENT';

export type DocumentScanStatus = 'NOT_SCANNED' | 'CLEAN' | 'REJECTED' | 'SCAN_FAILED';
