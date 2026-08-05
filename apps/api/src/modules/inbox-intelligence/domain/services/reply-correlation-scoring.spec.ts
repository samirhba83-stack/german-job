import { scoreCorrelation, SentMessageRef } from './reply-correlation-scoring';

function ref(overrides: Partial<SentMessageRef> = {}): SentMessageRef {
  return { connectedMailboxSendAttemptId: 'attempt-1', applicationId: 'app-1', campaignId: 'campaign-1', ...overrides };
}

describe('scoreCorrelation', () => {
  it('returns UNRELATED with zero confidence and no correlated ids when no signal matches', () => {
    const result = scoreCorrelation({ matchByThreadId: null, matchByInReplyTo: null, matchesByReferences: [] });
    expect(result.status).toBe('UNRELATED');
    expect(result.confidence).toBe(0);
    expect(result.correlatedApplicationId).toBeNull();
    expect(result.correlatedCampaignId).toBeNull();
    expect(result.correlatedConnectedMailboxSendAttemptId).toBeNull();
  });

  it('returns MATCHED at 0.97 confidence when the thread id matches, the strongest signal', () => {
    const threadMatch = ref({ connectedMailboxSendAttemptId: 'attempt-thread' });
    const result = scoreCorrelation({ matchByThreadId: threadMatch, matchByInReplyTo: null, matchesByReferences: [] });
    expect(result.status).toBe('MATCHED');
    expect(result.confidence).toBe(0.97);
    expect(result.correlatedApplicationId).toBe('app-1');
    expect(result.correlatedConnectedMailboxSendAttemptId).toBe('attempt-thread');
  });

  it('returns MATCHED at 0.92 confidence via In-Reply-To when there is no thread-id match', () => {
    const inReplyToMatch = ref({ connectedMailboxSendAttemptId: 'attempt-irt' });
    const result = scoreCorrelation({ matchByThreadId: null, matchByInReplyTo: inReplyToMatch, matchesByReferences: [] });
    expect(result.status).toBe('MATCHED');
    expect(result.confidence).toBe(0.92);
    expect(result.correlatedConnectedMailboxSendAttemptId).toBe('attempt-irt');
  });

  it('returns MATCHED at 0.85 confidence via References when all references resolve to the same application', () => {
    const result = scoreCorrelation({
      matchByThreadId: null,
      matchByInReplyTo: null,
      matchesByReferences: [ref({ connectedMailboxSendAttemptId: 'a' }), ref({ connectedMailboxSendAttemptId: 'b' })],
    });
    expect(result.status).toBe('MATCHED');
    expect(result.confidence).toBe(0.85);
    // First reference match wins when picking the returned send-attempt id.
    expect(result.correlatedConnectedMailboxSendAttemptId).toBe('a');
  });

  it('returns AMBIGUOUS when References resolve to more than one distinct application', () => {
    const result = scoreCorrelation({
      matchByThreadId: null,
      matchByInReplyTo: null,
      matchesByReferences: [ref({ applicationId: 'app-1' }), ref({ applicationId: 'app-2' })],
    });
    expect(result.status).toBe('AMBIGUOUS');
    expect(result.correlatedApplicationId).toBeNull();
    expect(result.correlatedConnectedMailboxSendAttemptId).toBeNull();
  });

  it('prioritizes thread-id over In-Reply-To when both match the SAME application', () => {
    const threadMatch = ref({ connectedMailboxSendAttemptId: 'attempt-thread', applicationId: 'app-1' });
    const inReplyToMatch = ref({ connectedMailboxSendAttemptId: 'attempt-irt', applicationId: 'app-1' });
    const result = scoreCorrelation({ matchByThreadId: threadMatch, matchByInReplyTo: inReplyToMatch, matchesByReferences: [] });
    expect(result.status).toBe('MATCHED');
    expect(result.confidence).toBe(0.97);
    expect(result.correlatedConnectedMailboxSendAttemptId).toBe('attempt-thread');
  });

  it('returns UNSAFE_TO_PROCESS when thread-id and In-Reply-To resolve to DIFFERENT applications, never guessing', () => {
    const threadMatch = ref({ connectedMailboxSendAttemptId: 'attempt-thread', applicationId: 'app-1' });
    const inReplyToMatch = ref({ connectedMailboxSendAttemptId: 'attempt-irt', applicationId: 'app-2' });
    const result = scoreCorrelation({ matchByThreadId: threadMatch, matchByInReplyTo: inReplyToMatch, matchesByReferences: [] });
    expect(result.status).toBe('UNSAFE_TO_PROCESS');
    expect(result.confidence).toBe(0);
    expect(result.correlatedApplicationId).toBeNull();
    expect(result.correlatedConnectedMailboxSendAttemptId).toBeNull();
  });

  it('records evidence for every signal checked, whether it matched or not', () => {
    const result = scoreCorrelation({ matchByThreadId: null, matchByInReplyTo: null, matchesByReferences: [] });
    const signals = result.evidence.map((e) => e.signal);
    expect(signals).toEqual(expect.arrayContaining(['PROVIDER_THREAD_ID', 'IN_REPLY_TO_HEADER', 'REFERENCES_HEADER']));
    expect(result.evidence.every((e) => e.matched === false)).toBe(true);
  });

  it('treats two applicationId-null refs from different campaigns as distinct for AMBIGUOUS resolution', () => {
    const result = scoreCorrelation({
      matchByThreadId: null,
      matchByInReplyTo: null,
      matchesByReferences: [ref({ applicationId: null, campaignId: 'campaign-a' }), ref({ applicationId: null, campaignId: 'campaign-b' })],
    });
    expect(result.status).toBe('AMBIGUOUS');
  });
});
