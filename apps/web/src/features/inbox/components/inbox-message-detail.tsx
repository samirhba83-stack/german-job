'use client';

import { Badge } from '@/components/ui/badge';
import { DefinitionField } from '@/components/ui/definition-field';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { ContextHeader } from '@/components/shell/context-header';
import { ErrorState } from '@/components/shell/error-state';
import { ApiError } from '@/lib/api-client';
import { REPLY_PRIMARY_CATEGORY_TONE, INBOX_MESSAGE_REVIEW_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import { useInboxMessage } from '../hooks/use-inbox-message';
import { InboxCorrectionPanel } from './inbox-correction-panel';
import { TransitionProposalPanel } from './transition-proposal-panel';
import { ReplyDraftPanel } from './reply-draft-panel';
import type { ExtractedRecruitmentFactsDto } from '../types';

function WorkspaceSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-heading-md font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}

const FACT_LABELS: Array<{ key: keyof ExtractedRecruitmentFactsDto; label: string }> = [
  { key: 'interviewType', label: 'Interview type' },
  { key: 'interviewTime', label: 'Interview time' },
  { key: 'timeZone', label: 'Time zone' },
  { key: 'physicalAddress', label: 'Address' },
  { key: 'videoMeetingLink', label: 'Meeting link' },
  { key: 'contactPersonName', label: 'Contact' },
  { key: 'contactEmail', label: 'Contact email' },
  { key: 'contactPhone', label: 'Contact phone' },
  { key: 'compensationMention', label: 'Compensation mentioned' },
  { key: 'contractTypeMention', label: 'Contract type mentioned' },
  { key: 'requiredReplyAction', label: 'Requested action' },
];

/** Real, structured facts pulled from the reply — every field is either a real extracted value or
 * absent; nothing here is guessed (M29 Non-Negotiable Principle #7: "never fabricate"). Dates are
 * shown as the original text when ambiguous (Phase 13), never a silently-resolved guess. */
function ExtractedFactsSection({ facts }: { facts: ExtractedRecruitmentFactsDto }) {
  const dateFields: Array<{ label: string; value: ExtractedRecruitmentFactsDto['interviewDate'] }> = [
    { label: 'Interview date', value: facts.interviewDate },
    { label: 'Submission deadline', value: facts.submissionDeadline },
    { label: 'Assessment deadline', value: facts.assessmentDeadline },
    { label: 'Proposed start date', value: facts.proposedStartDate },
  ];
  const presentDateFields = dateFields.filter((f) => f.value !== null);
  const presentTextFields = FACT_LABELS.filter((f) => facts[f.key]);
  const hasDocuments = facts.requestedDocuments.length > 0;

  if (presentDateFields.length === 0 && presentTextFields.length === 0 && !hasDocuments) {
    return <p className="text-body-sm text-secondary">No structured details were extracted from this message.</p>;
  }

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {presentDateFields.map((f) => (
        <DefinitionField
          key={f.label}
          label={f.label}
          value={f.value!.isAmbiguous ? `${f.value!.originalText} (unclear — please confirm)` : f.value!.originalText}
        />
      ))}
      {presentTextFields.map((f) => (
        <DefinitionField key={f.key} label={f.label} value={String(facts[f.key])} />
      ))}
      {hasDocuments && <DefinitionField label="Requested documents" value={facts.requestedDocuments.join(', ')} />}
    </dl>
  );
}

/**
 * M29 Phase 17 — the real per-reply detail workspace: excerpt, evidence, correlated application,
 * proposed transition, correction controls, draft, and every real related record from
 * `GET /inbox/messages/:id`. There is no user-facing audit-trail endpoint on the real backend
 * (only `EmailSecurityAuditEvent` rows exist, exposed to admins only, on a different controller) —
 * this page shows the real `corrections` history instead of fabricating an "audit trail" section
 * the API doesn't back.
 */
export function InboxMessageDetail({ messageId }: { messageId: string }) {
  const { data: message, isLoading, isError, error } = useInboxMessage(messageId);

  if (isLoading) {
    return (
      <SkeletonRegion loading label="Loading message">
        <div className="space-y-4">
          <Skeleton variant="card" className="h-24" />
          <Skeleton variant="card" className="h-48" />
        </div>
      </SkeletonRegion>
    );
  }

  if (isError || !message) {
    return <ErrorState message={error instanceof ApiError ? error.message : 'This message could not be loaded.'} />;
  }

  return (
    <div className="space-y-8">
      <ContextHeader
        title={message.subject || '(no subject)'}
        status={
          <div className="flex gap-2">
            {message.primaryCategory && <Badge tone={REPLY_PRIMARY_CATEGORY_TONE[message.primaryCategory]}>{humanizeStatus(message.primaryCategory)}</Badge>}
            <Badge tone={INBOX_MESSAGE_REVIEW_STATUS_TONE[message.reviewStatus]}>{humanizeStatus(message.reviewStatus)}</Badge>
          </div>
        }
      />

      <WorkspaceSection title="Overview">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <DefinitionField label="From" value={message.fromAddress} />
          <DefinitionField label="Received" value={formatDateTime(message.receivedAt)} />
          <DefinitionField label="Language" value={message.detectedLanguage ? humanizeStatus(message.detectedLanguage) : 'Unknown'} />
          <DefinitionField label="Correlation" value={humanizeStatus(message.correlationStatus)} />
          <DefinitionField label="Correlated application" value={message.correlatedApplicationId ?? 'None'} />
          {message.classificationConfidence !== null && (
            <DefinitionField label="Classification confidence" value={`${Math.round(message.classificationConfidence * 100)}%`} />
          )}
          {message.classificationSource && <DefinitionField label="Classified by" value={humanizeStatus(message.classificationSource)} />}
        </dl>
      </WorkspaceSection>

      {message.sanitizedExcerpt && (
        <WorkspaceSection title="Message excerpt">
          <p className="whitespace-pre-wrap rounded-md border border-border bg-background-subtle p-4 text-body-sm text-primary">{message.sanitizedExcerpt}</p>
        </WorkspaceSection>
      )}

      <WorkspaceSection title="Classification">
        <InboxCorrectionPanel message={message} />
      </WorkspaceSection>

      {message.extractedFacts && (
        <WorkspaceSection title="Extracted details">
          <ExtractedFactsSection facts={message.extractedFacts} />
        </WorkspaceSection>
      )}

      {message.recommendedNextAction && (
        <WorkspaceSection title="Recommended next step">
          <div className="rounded-md border border-border bg-background-subtle p-4">
            <p className="text-body font-medium text-primary">{message.recommendedNextAction.description}</p>
            <p className="mt-1 text-caption text-secondary">Based on: {message.recommendedNextAction.basedOnEvidence}</p>
          </div>
        </WorkspaceSection>
      )}

      {message.transitionProposals.length > 0 && (
        <WorkspaceSection title="Suggested application updates">
          <div className="space-y-2">
            {message.transitionProposals.map((proposal) => (
              <TransitionProposalPanel key={proposal.id} messageId={message.id} proposal={proposal} />
            ))}
          </div>
        </WorkspaceSection>
      )}

      <WorkspaceSection title="Reply draft">
        <ReplyDraftPanel message={message} drafts={message.drafts} />
      </WorkspaceSection>

      {message.corrections.length > 0 && (
        <WorkspaceSection title="Corrections">
          <ul className="space-y-2">
            {message.corrections.map((correction) => (
              <li key={correction.id} className="rounded-md border border-border bg-background-subtle p-3 text-body-sm text-secondary">
                <span className="font-medium text-primary">{humanizeStatus(correction.correctionType)}</span> corrected{correction.reason ? ` — ${correction.reason}` : ''} ·{' '}
                {formatDateTime(correction.createdAt)}
              </li>
            ))}
          </ul>
        </WorkspaceSection>
      )}
    </div>
  );
}
