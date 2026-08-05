import { NotYetAvailable } from '@/components/shell/not-yet-available';

export default function AdminPage() {
  return (
    <NotYetAvailable
      title="Administration"
      reason="No administration backend module exists yet — this screen has no real data source to show."
    />
  );
}
