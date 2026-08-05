import { NormalizedInboxMessage } from '../models/normalized-message';
import { ReplyPrimaryCategory, ReplySecondaryLabel } from '../models/reply-taxonomy';
import { ExtractedRecruitmentFacts, emptyExtractedFacts, DateExtraction } from '../models/extracted-facts';

export interface RuleEngineEvidence {
  readonly ruleId: string;
  readonly matchedText: string;
}

export interface RuleEngineResult {
  readonly category: ReplyPrimaryCategory;
  readonly secondaryLabels: ReadonlyArray<ReplySecondaryLabel>;
  readonly confidence: number;
  readonly evidence: ReadonlyArray<RuleEngineEvidence>;
  readonly matchedRuleIds: ReadonlyArray<string>;
  readonly extractedFacts: ExtractedRecruitmentFacts;
  /** True once at least one rule with real, non-`NEEDS_MANUAL_REVIEW`/`UNKNOWN` evidence fired —
   * `ReplyDecisionPolicy` uses this to decide whether AI should even be consulted at all (Phase
   * 10: "AI should run only when rules are insufficient"). */
  readonly rulesWereSufficient: boolean;
}

interface RuleDefinition {
  readonly id: string;
  readonly category: ReplyPrimaryCategory;
  readonly secondaryLabels: ReadonlyArray<ReplySecondaryLabel>;
  readonly confidence: number;
  readonly test: (message: NormalizedInboxMessage) => string | null; // returns matched text, or null
}

const DELIVERY_FAILURE_PATTERN = /undeliver|delivery (has )?failed|delivery status notification|mail delivery (subsystem|failed)|zustellung.*(fehlgeschlagen|nicht m[oö]glich)|unzustellbar/i;
const REJECTION_EN_PATTERN = /unfortunately.{0,80}(not|unable|decided|other candidate)|we (regret|will not be moving forward|have decided to proceed with other)|not (be )?(moving forward|successful)|your application (was|has been) (unsuccessful|rejected)/i;
const REJECTION_DE_PATTERN = /leider.{0,80}(nicht|absage)|wir haben uns (leider )?(entschieden|f[uü]r einen anderen)|(eine )?absage|nicht ber[uü]cksichtigen konnten/i;
const INTERVIEW_EN_PATTERN = /(would like to|like to) invite you|schedule (an|a) interview|interview (invitation|slot|appointment)|arrange (a|an) (call|interview|meeting)/i;
const INTERVIEW_DE_PATTERN = /vorstellungsgespr[aä]ch|zum? (interview|gespr[aä]ch) einladen|terminvorschlag/i;
const DOCUMENT_REQUEST_EN_PATTERN = /please (send|provide|attach|upload)|could you (please )?(send|provide)|kindly (send|provide)/i;
const DOCUMENT_REQUEST_DE_PATTERN = /bitte (senden|schicken|reichen) sie|k[oö]nnten sie uns.{0,40}(senden|zusenden|zukommen lassen)/i;
const OFFER_EN_PATTERN = /pleased to offer|we are (happy|delighted) to (offer|extend)|job offer|employment contract/i;
const OFFER_DE_PATTERN = /wir freuen uns.{0,60}(anzubieten|vertrag)|arbeitsvertrag|vertragsangebot/i;
const APPLICATION_RECEIVED_PATTERN = /(we have )?received your application|application (has been )?received|ihre bewerbung.{0,30}(erhalten|eingegangen)|bewerbungseingang/i;
const UNDER_REVIEW_PATTERN = /(currently )?review(ing)? your application|under review|wird derzeit gepr[uü]ft|befindet sich.{0,20}pr[uü]fung/i;
const WAITLIST_PATTERN = /wait[- ]?list|on hold|delay(ed)?|take (a )?bit longer|etwas l[aä]nger dauern|warteliste/i;
const ASSESSMENT_PATTERN = /assessment (test|invitation)|online test|coding challenge|take-home (task|assignment)|einen? test absolvieren|assessment[- ]center/i;
const REFERRAL_PATTERN = /(other|different|alternative) (position|role|opening)|might (be a better fit|suit you better) for|andere (position|stelle)/i;
const WITHDRAWAL_PATTERN = /confirm(ing)? (your )?withdrawal|application (has been )?withdrawn|r[uü]ckzug ihrer bewerbung|zur[uü]ckgezogen/i;
const AVAILABILITY_PATTERN = /when (are|would) you (be )?available|share your availability|verf[uü]gbarkeit mitteilen|wann.{0,20}(zeit|verf[uü]gbar)/i;
const OUT_OF_OFFICE_PATTERN = /out of (the )?office|currently (unavailable|away)|abwesenheit|derzeit nicht im b[uü]ro|urlaub bis/i;
const SPAM_PATTERN = /unsubscribe.{0,10}here|limited time offer|click here to claim|congratulations.{0,20}won/i;

const RULES: ReadonlyArray<RuleDefinition> = [
  { id: 'RULE_DELIVERY_FAILURE_TEXT', category: 'DELIVERY_FAILURE', secondaryLabels: ['AUTOMATED_REPLY'], confidence: 0.95, test: (m) => matchOrNull(DELIVERY_FAILURE_PATTERN, `${m.subject}\n${m.candidateRelevantBody}`) },
  { id: 'RULE_OUT_OF_OFFICE_TEXT', category: 'OUT_OF_OFFICE', secondaryLabels: ['AUTOMATED_REPLY', 'NEUTRAL'], confidence: 0.85, test: (m) => matchOrNull(OUT_OF_OFFICE_PATTERN, `${m.subject}\n${m.candidateRelevantBody}`) },
  { id: 'RULE_OFFER_EN', category: 'ACCEPTANCE_OR_OFFER', secondaryLabels: ['POSITIVE', 'ACTION_REQUIRED', 'HUMAN_REPLY'], confidence: 0.8, test: (m) => matchOrNull(OFFER_EN_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_OFFER_DE', category: 'ACCEPTANCE_OR_OFFER', secondaryLabels: ['POSITIVE', 'ACTION_REQUIRED', 'HUMAN_REPLY'], confidence: 0.8, test: (m) => matchOrNull(OFFER_DE_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_REJECTION_EN', category: 'REJECTION', secondaryLabels: ['NEGATIVE', 'HUMAN_REPLY'], confidence: 0.8, test: (m) => matchOrNull(REJECTION_EN_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_REJECTION_DE', category: 'REJECTION', secondaryLabels: ['NEGATIVE', 'HUMAN_REPLY'], confidence: 0.8, test: (m) => matchOrNull(REJECTION_DE_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_INTERVIEW_EN', category: 'INTERVIEW_INVITATION', secondaryLabels: ['POSITIVE', 'ACTION_REQUIRED', 'INTERVIEW_DATE_PRESENT', 'HUMAN_REPLY'], confidence: 0.8, test: (m) => matchOrNull(INTERVIEW_EN_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_INTERVIEW_DE', category: 'INTERVIEW_INVITATION', secondaryLabels: ['POSITIVE', 'ACTION_REQUIRED', 'INTERVIEW_DATE_PRESENT', 'HUMAN_REPLY'], confidence: 0.8, test: (m) => matchOrNull(INTERVIEW_DE_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_CALENDAR_INVITE', category: 'INTERVIEW_INVITATION', secondaryLabels: ['ACTION_REQUIRED', 'INTERVIEW_DATE_PRESENT', 'HUMAN_REPLY'], confidence: 0.75, test: (m) => (m.hasCalendarInvite ? 'calendar invite attached' : null) },
  { id: 'RULE_ASSESSMENT', category: 'ASSESSMENT_OR_TEST_INVITATION', secondaryLabels: ['ACTION_REQUIRED', 'HUMAN_REPLY'], confidence: 0.75, test: (m) => matchOrNull(ASSESSMENT_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_DOCUMENT_REQUEST_EN', category: 'DOCUMENT_REQUEST', secondaryLabels: ['ACTION_REQUIRED', 'DOCUMENTS_REQUIRED', 'HUMAN_REPLY'], confidence: 0.7, test: (m) => matchOrNull(DOCUMENT_REQUEST_EN_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_DOCUMENT_REQUEST_DE', category: 'DOCUMENT_REQUEST', secondaryLabels: ['ACTION_REQUIRED', 'DOCUMENTS_REQUIRED', 'HUMAN_REPLY'], confidence: 0.7, test: (m) => matchOrNull(DOCUMENT_REQUEST_DE_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_AVAILABILITY_REQUEST', category: 'AVAILABILITY_REQUEST', secondaryLabels: ['ACTION_REQUIRED', 'HUMAN_REPLY'], confidence: 0.7, test: (m) => matchOrNull(AVAILABILITY_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_WITHDRAWAL', category: 'WITHDRAWAL_CONFIRMATION', secondaryLabels: ['NEUTRAL', 'HUMAN_REPLY'], confidence: 0.75, test: (m) => matchOrNull(WITHDRAWAL_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_REFERRAL', category: 'REFERRAL_TO_OTHER_POSITION', secondaryLabels: ['NEUTRAL', 'HUMAN_REPLY'], confidence: 0.65, test: (m) => matchOrNull(REFERRAL_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_WAITLIST', category: 'WAITLIST_OR_DELAY', secondaryLabels: ['NEUTRAL', 'HUMAN_REPLY'], confidence: 0.65, test: (m) => matchOrNull(WAITLIST_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_UNDER_REVIEW', category: 'APPLICATION_UNDER_REVIEW', secondaryLabels: ['NEUTRAL'], confidence: 0.6, test: (m) => matchOrNull(UNDER_REVIEW_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_APPLICATION_RECEIVED', category: 'APPLICATION_RECEIVED_CONFIRMATION', secondaryLabels: ['NEUTRAL', 'AUTOMATED_REPLY'], confidence: 0.7, test: (m) => matchOrNull(APPLICATION_RECEIVED_PATTERN, m.candidateRelevantBody) },
  { id: 'RULE_SPAM_MARKER', category: 'SPAM_OR_UNRELATED', secondaryLabels: [], confidence: 0.7, test: (m) => matchOrNull(SPAM_PATTERN, m.candidateRelevantBody) },
];

function matchOrNull(pattern: RegExp, text: string): string | null {
  const match = pattern.exec(text);
  return match ? match[0] : null;
}

// Greedy (not lazy) and hyphen-inclusive: a lazy quantifier here stops as soon as the trailing
// \d{1,4} is satisfiable, truncating "15.03.2026" down to "15.03" and losing the year — making an
// otherwise-unambiguous date incorrectly report as ambiguous. The hyphen is required in the
// character class for ISO 8601 (YYYY-MM-DD) dates to ever reach `extractDateNear`'s `isoLike` check.
const DEADLINE_PHRASE_PATTERN = /\b(by|before|until|bis( zum)?|Frist(?: bis)?|deadline(?: is)?)\s+([A-Za-zÄÖÜäöü0-9.,/\- ]{3,30}\d{1,4})/gi;

/** Phase 13 — deliberately conservative: a real calendar-style date (DD.MM.YYYY, YYYY-MM-DD, or
 * "15 March 2026"/"15. März 2026") is normalized; anything else found by the deadline-phrase
 * pattern is preserved as ambiguous original text, never guessed at (Phase 13: "if date
 * interpretation is ambiguous, preserve original text, mark ambiguity, require user
 * confirmation"). */
function extractDateNear(text: string, phraseMatch: string): DateExtraction {
  const isoLike = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(phraseMatch);
  const dottedLike = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(phraseMatch);
  if (isoLike) {
    return { originalText: phraseMatch, normalizedDate: `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`, isAmbiguous: false, ambiguityReason: null };
  }
  if (dottedLike) {
    const day = dottedLike[1].padStart(2, '0');
    const month = dottedLike[2].padStart(2, '0');
    return { originalText: phraseMatch, normalizedDate: `${dottedLike[3]}-${month}-${day}`, isAmbiguous: false, ambiguityReason: null };
  }
  return { originalText: phraseMatch, normalizedDate: null, isAmbiguous: true, ambiguityReason: 'No unambiguous DD.MM.YYYY or YYYY-MM-DD date found near this deadline phrase — the exact date requires human confirmation.' };
}

function extractDeadline(body: string): DateExtraction | null {
  const match = DEADLINE_PHRASE_PATTERN.exec(body);
  DEADLINE_PHRASE_PATTERN.lastIndex = 0; // reset global regex state between calls
  return match ? extractDateNear(body, match[0]) : null;
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\+?\d[\d ()/-]{7,17}\d/;
const VIDEO_LINK_PATTERN = /(https?:\/\/)?(zoom\.us|teams\.microsoft\.com|meet\.google\.com|webex\.com)\/[^\s]+/i;

function extractCommonFacts(message: NormalizedInboxMessage): Partial<ExtractedRecruitmentFacts> {
  const body = message.candidateRelevantBody;
  const emailMatch = EMAIL_PATTERN.exec(body);
  const phoneMatch = PHONE_PATTERN.exec(body);
  const videoMatch = VIDEO_LINK_PATTERN.exec(body);
  return {
    contactEmail: emailMatch ? emailMatch[0] : null,
    contactPhone: phoneMatch ? phoneMatch[0].trim() : null,
    videoMeetingLink: videoMatch ? videoMatch[0] : null,
    submissionDeadline: extractDeadline(body),
  };
}

/**
 * M29 Phase 10 — the deterministic first-pass classifier. Rules are checked in the fixed priority
 * order above (deterministic headers and unambiguous templates first, generic keyword matches
 * last); the FIRST rule that matches wins — never a weighted vote across multiple partial
 * matches, keeping the result fully explainable ("rule X matched text Y" is always a complete
 * causal explanation). Returns `NEEDS_MANUAL_REVIEW` (not `UNKNOWN`) when nothing matched but the
 * message clearly IS a real human reply (has real body content) — `UNKNOWN` is reserved for
 * `AiClassificationPort` (or a future adapter) to potentially resolve; when AI is unavailable
 * (this milestone's own default), `NEEDS_MANUAL_REVIEW` is the correct, honest terminal state.
 */
export function classifyByRules(message: NormalizedInboxMessage): RuleEngineResult {
  if (message.isDeliveryFailure) {
    return terminalResult('DELIVERY_FAILURE', ['AUTOMATED_REPLY'], 0.98, [{ ruleId: 'RULE_DELIVERY_FAILURE_HEADER', matchedText: 'provider delivery-failure header' }], message);
  }
  if (message.isAutoReply && !message.isOutOfOffice) {
    return terminalResult('AUTOMATIC_REPLY', ['AUTOMATED_REPLY'], 0.9, [{ ruleId: 'RULE_AUTO_REPLY_HEADER', matchedText: 'provider auto-reply header' }], message);
  }
  if (message.isOutOfOffice) {
    return terminalResult('OUT_OF_OFFICE', ['AUTOMATED_REPLY', 'NEUTRAL'], 0.9, [{ ruleId: 'RULE_OUT_OF_OFFICE_HEADER', matchedText: 'provider auto-reply header + out-of-office language' }], message);
  }

  for (const rule of RULES) {
    const matchedText = rule.test(message);
    if (matchedText) {
      return terminalResult(rule.category, rule.secondaryLabels, rule.confidence, [{ ruleId: rule.id, matchedText }], message);
    }
  }

  return {
    category: 'NEEDS_MANUAL_REVIEW',
    secondaryLabels: [],
    confidence: 0,
    evidence: [],
    matchedRuleIds: [],
    extractedFacts: { ...emptyExtractedFacts(), ...extractCommonFacts(message) },
    rulesWereSufficient: false,
  };
}

function terminalResult(
  category: ReplyPrimaryCategory,
  secondaryLabels: ReadonlyArray<ReplySecondaryLabel>,
  confidence: number,
  evidence: ReadonlyArray<RuleEngineEvidence>,
  message: NormalizedInboxMessage,
): RuleEngineResult {
  return {
    category,
    secondaryLabels,
    confidence,
    evidence,
    matchedRuleIds: evidence.map((e) => e.ruleId),
    extractedFacts: { ...emptyExtractedFacts(), ...extractCommonFacts(message) },
    rulesWereSufficient: true,
  };
}
