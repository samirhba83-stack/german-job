import { InboxMessageDetail } from '@/features/inbox/components/inbox-message-detail';

export default function InboxMessageDetailPage({ params }: { params: { id: string } }) {
  return <InboxMessageDetail messageId={params.id} />;
}
