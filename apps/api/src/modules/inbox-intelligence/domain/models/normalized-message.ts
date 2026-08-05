/** M29 Phase 8 — the one internal model every provider message is normalized into before rule/AI
 * classification ever sees it. `candidateRelevantBody` is the cleaned, quote-stripped,
 * signature-stripped text — never the raw body — while `originalMetadata` preserves every real
 * provider identifier untouched (Phase 8: "do not destroy original provider identifiers"). */
export interface NormalizedInboxMessage {
  readonly providerMessageId: string;
  readonly providerThreadId: string | null;
  readonly rfcMessageId: string | null;
  readonly inReplyTo: string | null;
  readonly referencesHeaders: ReadonlyArray<string>;
  readonly fromAddress: string;
  readonly toAddress: string;
  readonly subject: string;
  readonly receivedAt: Date;

  /** The cleaned body actually handed to the rule engine / AI — quoted prior conversation and
   * signatures stripped (Phase 8: "do not treat quoted previous emails as new reply content"). */
  readonly candidateRelevantBody: string;
  readonly detectedLanguage: 'DE' | 'EN' | 'UNKNOWN';
  readonly isAutoReply: boolean;
  readonly isDeliveryFailure: boolean;
  readonly isOutOfOffice: boolean;
  readonly hasCalendarInvite: boolean;
  readonly attachmentFileNames: ReadonlyArray<string>;
}
