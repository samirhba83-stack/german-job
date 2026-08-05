import { NotYetAvailable } from '@/components/shell/not-yet-available';

export default function MissionControlPage() {
  return (
    <NotYetAvailable
      title="Mission Control"
      reason="Mission Control is gated on the mission-control backend module gaining a controller — it has no HTTP surface today, so there is no real data this screen could show."
    />
  );
}
