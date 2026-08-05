import { NotYetAvailable } from '@/components/shell/not-yet-available';

/**
 * Milestone 22.3 audit fix: this route previously rendered a bare, unstyled heading with nothing
 * else — no indication of whether the page was broken, loading, or genuinely empty, a real Trust
 * Layer violation (docs/interaction-framework/02-interaction-principles.md "every interruption
 * has a reason"). The applications backend is real and live; this screen's real implementation
 * is Milestone 23 scope — `use-applications.ts` remains an honest stub until then.
 */
export function ApplicationList() {
  return (
    <NotYetAvailable
      title="Applications"
      reason="The applications backend is real and live, but this screen's real implementation is reserved for Milestone 23."
    />
  );
}
