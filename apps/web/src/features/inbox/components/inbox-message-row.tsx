import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { REPLY_PRIMARY_CATEGORY_TONE, INBOX_MESSAGE_REVIEW_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDateTime } from '@/lib/format-date';
import type { InboxMessageDto } from '../types';

export function InboxMessageRow({ message }: { message: InboxMessageDto }) {
  return (
    <li>
      {/* Link is the real interactive/focusable element; Card stays non-interactive (no second
          tabIndex) — the same nested-interactive-element fix already applied elsewhere in this
          codebase (docs/interaction-framework/13-decision-records.md ADR-012). */}
      <Link href={`/inbox/${message.id}`} className="block">
        <Card padding="md" className="space-y-1 transition-shadow hover:shadow-elevation-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate text-body font-medium text-primary">{message.subject || '(no subject)'}</p>
            <div className="flex shrink-0 items-center gap-2">
              {message.primaryCategory && <Badge tone={REPLY_PRIMARY_CATEGORY_TONE[message.primaryCategory]}>{humanizeStatus(message.primaryCategory)}</Badge>}
              <Badge tone={INBOX_MESSAGE_REVIEW_STATUS_TONE[message.reviewStatus]}>{humanizeStatus(message.reviewStatus)}</Badge>
            </div>
          </div>
          <p className="truncate text-body-sm text-secondary">{message.fromAddress}</p>
          {message.sanitizedExcerpt && <p className="line-clamp-2 text-body-sm text-secondary">{message.sanitizedExcerpt}</p>}
          <p className="text-caption text-secondary">{formatDateTime(message.receivedAt)}</p>
        </Card>
      </Link>
    </li>
  );
}
