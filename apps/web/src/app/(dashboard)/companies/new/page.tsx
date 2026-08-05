import { NotYetAvailable } from '@/components/shell/not-yet-available';

export default function NewCompanyPage() {
  return (
    <NotYetAvailable
      title="Add a Company"
      reason="The companies backend is real and live, but the company-creation flow is reserved for Milestone 23 — it isn't built yet."
    />
  );
}
