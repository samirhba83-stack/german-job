import { InboxMessageDetail } from '@/features/inbox/components/inbox-message-detail';

// Next.js 15 — `params` is now a Promise on Server Component pages (real breaking change).
export default async function InboxMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InboxMessageDetail messageId={id} />;
}
