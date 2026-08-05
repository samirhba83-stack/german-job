import { NotYetAvailable } from '@/components/shell/not-yet-available';

/** Milestone 22.3 audit fix — see features/applications/components/application-list.tsx's
 * identical fix for the full rationale. */
export function JobListingList() {
  return (
    <NotYetAvailable
      title="Job Listings"
      reason="The jobs backend is real and live, but this screen's real implementation is reserved for Milestone 23."
    />
  );
}
