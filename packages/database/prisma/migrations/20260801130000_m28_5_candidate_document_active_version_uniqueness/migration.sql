-- M28.5 follow-up fix: a real Postgres concurrency test proved that, under the default READ
-- COMMITTED isolation level, two concurrent CandidateDocument.createNewVersion() calls for the
-- same (ownerUserId, documentType) with no prior active row could both read "no prior active"
-- before either commits, and both then insert a new isActive=true row — leaving two
-- simultaneously active versions for the same owner+type, with nothing at the application layer
-- alone preventing it. A partial unique index is the real, DB-level backstop: Postgres itself
-- guarantees at most one row can ever have isActive = true for a given (ownerUserId,
-- documentType) pair, and the losing concurrent insert fails with a real unique-constraint
-- violation (P2002) rather than silently succeeding — the same "DB constraint is the real
-- backstop under a genuine race" doctrine already established for WebhookEvent.providerEventId
-- (M27) and CheckoutSession.idempotencyKey (M27).
CREATE UNIQUE INDEX "candidate_documents_active_version_unique"
ON "candidate_documents" ("ownerUserId", "documentType")
WHERE "isActive" = true;
