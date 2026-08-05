import { NotYetAvailable } from '@/components/shell/not-yet-available';

export default function NewJobPage() {
  return (
    <NotYetAvailable
      title="Post a Job"
      reason="The jobs backend is real and live, but the job-posting flow is reserved for Milestone 23 — it isn't built yet."
    />
  );
}
