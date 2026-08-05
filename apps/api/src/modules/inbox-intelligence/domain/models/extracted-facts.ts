/** M29 Phase 13 — structured recruitment facts pulled from a matched reply. Every field is
 * optional and independently nullable: a real message rarely carries all of these at once, and
 * inventing a value for a field the message never mentioned would violate Non-Negotiable
 * Principle #7 ("never fabricate"). */
export interface ExtractedRecruitmentFacts {
  readonly interviewDate: DateExtraction | null;
  readonly interviewTime: string | null;
  readonly timeZone: string | null;
  readonly interviewType: 'IN_PERSON' | 'VIDEO_CALL' | 'PHONE_CALL' | 'UNSPECIFIED' | null;
  readonly physicalAddress: string | null;
  readonly videoMeetingLink: string | null;
  readonly contactPersonName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly requestedDocuments: ReadonlyArray<string>;
  readonly submissionDeadline: DateExtraction | null;
  readonly assessmentDeadline: DateExtraction | null;
  readonly proposedStartDate: DateExtraction | null;
  readonly compensationMention: string | null;
  readonly contractTypeMention: string | null;
  readonly requiredReplyAction: string | null;
}

/** M29 Phase 13 — "if date interpretation is ambiguous: preserve original text, mark ambiguity,
 * require user confirmation. Do not silently assume German time zone when the message explicitly
 * says otherwise." `normalizedDate` is null whenever `isAmbiguous` is true — an ambiguous date is
 * never silently resolved to a guessed value; only `originalText` is ever shown to the user in
 * that case. */
export interface DateExtraction {
  readonly originalText: string;
  readonly normalizedDate: string | null; // ISO 8601 date, only ever set when unambiguous
  readonly isAmbiguous: boolean;
  readonly ambiguityReason: string | null;
}

export function emptyExtractedFacts(): ExtractedRecruitmentFacts {
  return {
    interviewDate: null,
    interviewTime: null,
    timeZone: null,
    interviewType: null,
    physicalAddress: null,
    videoMeetingLink: null,
    contactPersonName: null,
    contactEmail: null,
    contactPhone: null,
    requestedDocuments: [],
    submissionDeadline: null,
    assessmentDeadline: null,
    proposedStartDate: null,
    compensationMention: null,
    contractTypeMention: null,
    requiredReplyAction: null,
  };
}
