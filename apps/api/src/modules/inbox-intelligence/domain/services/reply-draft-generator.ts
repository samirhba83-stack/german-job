import { ReplyDraftType, ReplyDraftPlaceholder } from '../models/reply-draft';
import { ExtractedRecruitmentFacts } from '../models/extracted-facts';

export interface ReplyDraftGenerationInput {
  readonly draftType: ReplyDraftType;
  readonly candidateName: string;
  readonly companyName: string;
  readonly jobTitle: string;
  readonly originalSubject: string;
  readonly language: 'DE' | 'EN';
  readonly facts: ExtractedRecruitmentFacts;
}

export interface GeneratedReplyDraft {
  readonly subject: string;
  readonly bodyText: string;
  readonly placeholders: ReadonlyArray<ReplyDraftPlaceholder>;
}

const REPLY_SUBJECT_PREFIX_DE = 'AW: ';
const REPLY_SUBJECT_PREFIX_EN = 'Re: ';

function replySubject(original: string, language: 'DE' | 'EN'): string {
  const prefix = language === 'DE' ? REPLY_SUBJECT_PREFIX_DE : REPLY_SUBJECT_PREFIX_EN;
  return original.toLowerCase().startsWith(prefix.toLowerCase().trim()) ? original : `${prefix}${original}`;
}

const CLOSING = { DE: 'Mit freundlichen Grüßen,', EN: 'Kind regards,' } as const;

/**
 * M29 Phase 16 — pure, deterministic draft text generation. Every fact placeholder is either
 * filled from a REAL extracted fact or left as an explicit `[PLACEHOLDER: ...]` marker the user
 * must fill in before sending (Phase 16: "never invent qualifications, availability or documents...
 * clearly mark placeholders requiring user confirmation"). Never calls AI — this milestone's own
 * decision to keep drafting fully deterministic and explainable.
 */
export function generateReplyDraft(input: ReplyDraftGenerationInput): GeneratedReplyDraft {
  const { candidateName, companyName, jobTitle, language, facts } = input;
  const subject = replySubject(input.originalSubject, language);
  const placeholders: ReplyDraftPlaceholder[] = [];

  function placeholder(label: string, value: string | null): string {
    if (value) return value;
    placeholders.push({ label, filled: false });
    return `[${label}]`;
  }

  const greeting = language === 'DE' ? `Sehr geehrte Damen und Herren,` : `Dear Hiring Team,`;
  const closing = `${CLOSING[language]}\n${candidateName}`;

  let body: string;
  switch (input.draftType) {
    case 'INTERVIEW_ACCEPTANCE': {
      const when = placeholder(language === 'DE' ? 'Interviewtermin bestätigen' : 'Confirm interview date/time', facts.interviewDate?.originalText ?? null);
      body =
        language === 'DE'
          ? `${greeting}\n\nvielen Dank für die Einladung zum Vorstellungsgespräch für die Position ${jobTitle} bei ${companyName}. Ich bestätige hiermit gerne den Termin: ${when}.\n\n${closing}`
          : `${greeting}\n\nThank you for inviting me to interview for the ${jobTitle} position at ${companyName}. I am pleased to confirm the following time: ${when}.\n\n${closing}`;
      break;
    }
    case 'REQUEST_ALTERNATIVE_TIME': {
      const alt = placeholder(language === 'DE' ? 'Alternativen Terminvorschlag eintragen' : 'Propose an alternative time', null);
      body =
        language === 'DE'
          ? `${greeting}\n\nvielen Dank für die Einladung zum Vorstellungsgespräch für die Position ${jobTitle}. Leider passt der vorgeschlagene Termin bei mir nicht. Wäre folgender Termin möglich: ${alt}?\n\n${closing}`
          : `${greeting}\n\nThank you for the interview invitation for the ${jobTitle} position. Unfortunately the proposed time does not work for me — would ${alt} be possible instead?\n\n${closing}`;
      break;
    }
    case 'DOCUMENT_SUBMISSION_ACKNOWLEDGMENT': {
      const docs = facts.requestedDocuments.length > 0 ? facts.requestedDocuments.join(', ') : placeholder(language === 'DE' ? 'Angeforderte Dokumente auflisten' : 'List requested documents', null);
      body =
        language === 'DE'
          ? `${greeting}\n\nanbei sende ich Ihnen die angeforderten Unterlagen (${docs}) für die Position ${jobTitle}.\n\n${closing}`
          : `${greeting}\n\nPlease find attached the requested document(s) (${docs}) for the ${jobTitle} position.\n\n${closing}`;
      break;
    }
    case 'INFORMATION_RESPONSE': {
      const info = placeholder(language === 'DE' ? 'Antwort auf die Anfrage eintragen' : 'Fill in your response to the request', null);
      body =
        language === 'DE'
          ? `${greeting}\n\nvielen Dank für Ihre Nachricht bezüglich der Position ${jobTitle}. ${info}\n\n${closing}`
          : `${greeting}\n\nThank you for your message regarding the ${jobTitle} position. ${info}\n\n${closing}`;
      break;
    }
    case 'POLITE_FOLLOWUP': {
      body =
        language === 'DE'
          ? `${greeting}\n\nich wollte mich höflich nach dem aktuellen Stand meiner Bewerbung für die Position ${jobTitle} bei ${companyName} erkundigen.\n\n${closing}`
          : `${greeting}\n\nI wanted to politely follow up on the status of my application for the ${jobTitle} position at ${companyName}.\n\n${closing}`;
      break;
    }
    case 'OFFER_ACKNOWLEDGMENT': {
      body =
        language === 'DE'
          ? `${greeting}\n\nvielen Dank für das Angebot für die Position ${jobTitle}. Ich werde es mir sorgfältig ansehen und melde mich in Kürze bei Ihnen.\n\n${closing}`
          : `${greeting}\n\nThank you for the offer for the ${jobTitle} position. I will review it carefully and get back to you shortly.\n\n${closing}`;
      break;
    }
    case 'REJECTION_ACKNOWLEDGMENT': {
      body =
        language === 'DE'
          ? `${greeting}\n\nvielen Dank für Ihre Rückmeldung zu meiner Bewerbung für die Position ${jobTitle}. Ich bedanke mich für die Gelegenheit und wünsche Ihnen und dem Team bei ${companyName} weiterhin viel Erfolg.\n\n${closing}`
          : `${greeting}\n\nThank you for letting me know about your decision regarding the ${jobTitle} position. I appreciate the opportunity and wish you and the team at ${companyName} continued success.\n\n${closing}`;
      break;
    }
  }

  return { subject, bodyText: body, placeholders };
}
