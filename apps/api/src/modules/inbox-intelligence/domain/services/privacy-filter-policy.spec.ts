import { checkPrivacyGate, PrivacyFilterInput } from './privacy-filter-policy';

function baseInput(overrides: Partial<PrivacyFilterInput> = {}): PrivacyFilterInput {
  return {
    inboxCapabilityActive: true,
    correlationStatus: 'MATCHED',
    alreadyProcessed: false,
    isOutgoingFromOwnMailbox: false,
    sizeBytes: 1000,
    maxAllowedSizeBytes: 10_000_000,
    ...overrides,
  };
}

describe('checkPrivacyGate', () => {
  it('allows a matched, active, in-bounds, not-yet-processed incoming message with no blocking reasons', () => {
    const result = checkPrivacyGate(baseInput());
    expect(result.allowed).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it('blocks when inbox-reading consent is not active', () => {
    const result = checkPrivacyGate(baseInput({ inboxCapabilityActive: false }));
    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toEqual(expect.arrayContaining([expect.stringContaining('consent is not active')]));
  });

  it('blocks a message that does not correlate to any known application (UNRELATED)', () => {
    const result = checkPrivacyGate(baseInput({ correlationStatus: 'UNRELATED' }));
    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toEqual(expect.arrayContaining([expect.stringContaining('never entered the recruitment-intelligence pipeline')]));
  });

  it('blocks a message with conflicting correlation signals (UNSAFE_TO_PROCESS)', () => {
    const result = checkPrivacyGate(baseInput({ correlationStatus: 'UNSAFE_TO_PROCESS' }));
    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toEqual(expect.arrayContaining([expect.stringContaining('signals conflict')]));
  });

  it('does not itself block AMBIGUOUS correlation — the caller applies its own separate AMBIGUOUS guard', () => {
    const result = checkPrivacyGate(baseInput({ correlationStatus: 'AMBIGUOUS' }));
    expect(result.allowed).toBe(true);
  });

  it('blocks an already-processed message (idempotent no-op)', () => {
    const result = checkPrivacyGate(baseInput({ alreadyProcessed: true }));
    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toEqual(expect.arrayContaining([expect.stringContaining('already processed')]));
  });

  it('blocks a message that was sent BY the candidate\'s own mailbox, not received', () => {
    const result = checkPrivacyGate(baseInput({ isOutgoingFromOwnMailbox: true }));
    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toEqual(expect.arrayContaining([expect.stringContaining('not received')]));
  });

  it('blocks an oversized message', () => {
    const result = checkPrivacyGate(baseInput({ sizeBytes: 20_000_000, maxAllowedSizeBytes: 10_000_000 }));
    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toEqual(expect.arrayContaining([expect.stringContaining('exceeds the')]));
  });

  it('accumulates every blocking reason rather than stopping at the first', () => {
    const result = checkPrivacyGate(
      baseInput({
        inboxCapabilityActive: false,
        correlationStatus: 'UNRELATED',
        alreadyProcessed: true,
        isOutgoingFromOwnMailbox: true,
        sizeBytes: 20_000_000,
        maxAllowedSizeBytes: 10_000_000,
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toHaveLength(5);
  });
});
