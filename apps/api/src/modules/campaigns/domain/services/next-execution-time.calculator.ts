import { ExecutionWindow } from '../value-objects/execution-window.vo';
import { IsWithinExecutionWindowSpecification } from '../specifications/is-within-execution-window.specification';

const HOUR_MS = 60 * 60 * 1000;
const MAX_HORIZON_DAYS = 14;

/**
 * Finds the next instant at or after `from` (and at or after `cooldownUntil`, if given) that
 * satisfies the campaign's ExecutionWindow. Steps hour-by-hour rather than computing the zoned
 * boundary analytically: ExecutionWindow only ever expresses whole-hour boundaries (see its
 * `create()` validation), so hourly stepping cannot skip over a valid window, and reusing
 * IsWithinExecutionWindowSpecification — the same specification M1 hardened for timezone
 * correctness — avoids a second, independently-fallible implementation of zoned weekday/hour/
 * holiday resolution (see is-within-execution-window.specification.ts's own history: the
 * original bug was exactly this kind of duplicated, un-exercised zone math).
 *
 * Lives in the Campaigns domain (moved here from Scheduler during the Phase 4 architecture
 * review after M4) because it is pure ExecutionWindow math — deterministic, with exactly one
 * correct answer — not a tunable business policy. Both Scheduler and Dispatcher depend on it
 * downward from their own peer position, instead of one reaching sideways into the other's
 * internals. Deliberately NOT a DI port: unlike priority/risk/timing-recommendation scoring,
 * there is no "alternative implementation" to swap in — it is not an AI-replaceable capability,
 * so it stays a plain, framework-free class like ExecutionWindowPolicy itself.
 *
 * Returns null if no eligible instant exists within MAX_HORIZON_DAYS — only reachable with a
 * pathological window configuration (e.g. a single weekday that is always a public holiday).
 */
export class NextExecutionTimeCalculator {
  calculate(window: ExecutionWindow, cooldownUntil: Date | null, from: Date): Date | null {
    const earliest = cooldownUntil && cooldownUntil.getTime() > from.getTime() ? cooldownUntil : from;
    let candidate = new Date(Math.ceil(earliest.getTime() / HOUR_MS) * HOUR_MS);
    const horizon = new Date(from.getTime() + MAX_HORIZON_DAYS * 24 * HOUR_MS);

    while (candidate.getTime() <= horizon.getTime()) {
      if (IsWithinExecutionWindowSpecification.isSatisfiedBy(window, candidate)) {
        return candidate;
      }
      candidate = new Date(candidate.getTime() + HOUR_MS);
    }

    return null;
  }
}
