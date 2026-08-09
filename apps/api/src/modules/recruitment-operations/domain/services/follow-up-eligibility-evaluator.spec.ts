import { evaluateFollowUpEligibility } from './follow-up-eligibility-evaluator';
import { FollowUpControlRecord, FollowUpControlType } from '../models/follow-up-control';

const NOW = new Date('2026-08-06T12:00:00.000Z');

function control(overrides: Partial<FollowUpControlRecord> = {}): FollowUpControlRecord {
  return {
    id: 'control-1',
    userId: 'user-1',
    applicationId: 'app-1',
    campaignId: 'campaign-1',
    companyId: null,
    jobId: null,
    sourceInboxMessageId: 'msg-1',
    sourceProviderMessageId: 'provider-msg-1',
    controlType: 'TEMPORARY_HOLD',
    status: 'ACTIVE',
    reasonCode: 'DOCUMENT_REQUEST',
    explanation: 'Documents requested.',
    classification: 'DOCUMENT_REQUEST',
    confidence: 0.7,
    evidence: null,
    createdByActorType: 'SYSTEM',
    createdByActorId: null,
    createdAt: NOW,
    effectiveAt: NOW,
    expiresAt: null,
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
    correlationId: null,
    idempotencyKey: 'key-1',
    version: 1,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('evaluateFollowUpEligibility', () => {
  it('is ELIGIBLE when no active control exists', () => {
    const result = evaluateFollowUpEligibility(null, NOW);
    expect(result.status).toBe('ELIGIBLE');
    expect(result.activeControl).toBeNull();
  });

  it('is ELIGIBLE when the active control has already passed its expiresAt, even before the resume tick catches up', () => {
    const expired = control({ controlType: 'WAITING_PERIOD', expiresAt: new Date(NOW.getTime() - 1000) });
    const result = evaluateFollowUpEligibility(expired, NOW);
    expect(result.status).toBe('ELIGIBLE');
    expect(result.reasonCode).toBe('HOLD_EXPIRED');
  });

  it('is not yet ELIGIBLE when expiresAt is still in the future', () => {
    const stillActive = control({ controlType: 'WAITING_PERIOD', expiresAt: new Date(NOW.getTime() + 1000) });
    const result = evaluateFollowUpEligibility(stillActive, NOW);
    expect(result.status).toBe('TEMPORARILY_BLOCKED');
  });

  it.each<FollowUpControlType>(['TEMPORARY_HOLD', 'WAITING_PERIOD'])('%s with no expiry is TEMPORARILY_BLOCKED', (controlType) => {
    const result = evaluateFollowUpEligibility(control({ controlType, expiresAt: null }), NOW);
    expect(result.status).toBe('TEMPORARILY_BLOCKED');
  });

  it('PERMANENT_SUPPRESSION is PERMANENTLY_BLOCKED regardless of any expiresAt value', () => {
    const result = evaluateFollowUpEligibility(control({ controlType: 'PERMANENT_SUPPRESSION', expiresAt: null }), NOW);
    expect(result.status).toBe('PERMANENTLY_BLOCKED');
  });

  it('DELIVERABILITY_BLOCK is PERMANENTLY_BLOCKED', () => {
    const result = evaluateFollowUpEligibility(control({ controlType: 'DELIVERABILITY_BLOCK', expiresAt: null }), NOW);
    expect(result.status).toBe('PERMANENTLY_BLOCKED');
  });

  it('MANUAL_REVIEW_HOLD is MANUAL_REVIEW_REQUIRED', () => {
    const result = evaluateFollowUpEligibility(control({ controlType: 'MANUAL_REVIEW_HOLD', expiresAt: null }), NOW);
    expect(result.status).toBe('MANUAL_REVIEW_REQUIRED');
  });

  it('carries the real reasonCode/explanation/activeControl through for every blocked status', () => {
    const c = control({ controlType: 'PERMANENT_SUPPRESSION', expiresAt: null, reasonCode: 'REJECTION', explanation: 'Application rejected.' });
    const result = evaluateFollowUpEligibility(c, NOW);
    expect(result.reasonCode).toBe('REJECTION');
    expect(result.explanation).toBe('Application rejected.');
    expect(result.activeControl).toBe(c);
  });
});
