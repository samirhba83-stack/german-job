import { decideReplyAction } from './reply-decision-policy';
import { HIGH_IMPACT_CATEGORIES } from '../models/reply-taxonomy';
import { ReplyPrimaryCategory } from '../models/reply-taxonomy';

const NON_HIGH_IMPACT_CATEGORY: ReplyPrimaryCategory = 'DOCUMENT_REQUEST';

describe('decideReplyAction', () => {
  it('never proposes a transition at LOW confidence, regardless of category', () => {
    const result = decideReplyAction(NON_HIGH_IMPACT_CATEGORY, 0.2);
    expect(result.confidenceBand).toBe('LOW');
    expect(result.shouldProposeTransition).toBe(false);
    expect(result.requiresExplicitConfirmation).toBe(true);
    expect(result.reviewStatus).toBe('PENDING_REVIEW');
  });

  it('LOW confidence includes the exact boundary just below the medium threshold', () => {
    const result = decideReplyAction(NON_HIGH_IMPACT_CATEGORY, 0.549);
    expect(result.confidenceBand).toBe('LOW');
  });

  it('auto-accepts DELIVERY_FAILURE at HIGH confidence — the one category allowed to auto-apply', () => {
    const result = decideReplyAction('DELIVERY_FAILURE', 0.9);
    expect(result.confidenceBand).toBe('HIGH');
    expect(result.shouldProposeTransition).toBe(true);
    expect(result.requiresExplicitConfirmation).toBe(false);
    expect(result.reviewStatus).toBe('AUTO_ACCEPTED');
  });

  it('does NOT auto-accept DELIVERY_FAILURE at only MEDIUM confidence', () => {
    const result = decideReplyAction('DELIVERY_FAILURE', 0.6);
    expect(result.confidenceBand).toBe('MEDIUM');
    expect(result.requiresExplicitConfirmation).toBe(true);
    expect(result.reviewStatus).toBe('PENDING_REVIEW');
  });

  it.each([...HIGH_IMPACT_CATEGORIES])('always requires explicit confirmation for high-impact category %s even at HIGH confidence', (category) => {
    const result = decideReplyAction(category, 0.99);
    expect(result.confidenceBand).toBe('HIGH');
    expect(result.shouldProposeTransition).toBe(true);
    expect(result.requiresExplicitConfirmation).toBe(true);
    expect(result.reviewStatus).toBe('PENDING_REVIEW');
  });

  it.each([...HIGH_IMPACT_CATEGORIES])('requires explicit confirmation for high-impact category %s at MEDIUM confidence too', (category) => {
    const result = decideReplyAction(category, 0.6);
    expect(result.confidenceBand).toBe('MEDIUM');
    expect(result.requiresExplicitConfirmation).toBe(true);
  });

  it('proposes a transition but still requires confirmation for a non-high-impact category at HIGH confidence', () => {
    const result = decideReplyAction(NON_HIGH_IMPACT_CATEGORY, 0.95);
    expect(result.confidenceBand).toBe('HIGH');
    expect(result.shouldProposeTransition).toBe(true);
    expect(result.requiresExplicitConfirmation).toBe(true);
    expect(result.reviewStatus).toBe('PENDING_REVIEW');
  });

  it('proposes a transition but still requires confirmation for a non-high-impact category at MEDIUM confidence', () => {
    const result = decideReplyAction(NON_HIGH_IMPACT_CATEGORY, 0.6);
    expect(result.confidenceBand).toBe('MEDIUM');
    expect(result.shouldProposeTransition).toBe(true);
    expect(result.requiresExplicitConfirmation).toBe(true);
    expect(result.reviewStatus).toBe('PENDING_REVIEW');
  });

  it('respects a custom confidence threshold configuration', () => {
    const result = decideReplyAction(NON_HIGH_IMPACT_CATEGORY, 0.7, { highConfidenceThreshold: 0.95, mediumConfidenceThreshold: 0.5 });
    expect(result.confidenceBand).toBe('MEDIUM');
  });

  it('never allows an unconfirmed automatic transition for any category other than DELIVERY_FAILURE', () => {
    const categories: ReplyPrimaryCategory[] = ['INTERVIEW_INVITATION', 'DOCUMENT_REQUEST', 'ACCEPTANCE_OR_OFFER', 'REJECTION', 'APPLICATION_RECEIVED_CONFIRMATION', 'SPAM_OR_UNRELATED'];
    for (const category of categories) {
      const result = decideReplyAction(category, 0.99);
      expect(result.requiresExplicitConfirmation).toBe(true);
    }
  });
});
