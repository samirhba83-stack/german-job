'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { ContextHeader } from '@/components/shell/context-header';
import { ErrorState } from '@/components/shell/error-state';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useInboxMessages } from '../hooks/use-inbox-messages';
import { INBOX_VIEWS } from '../lib/inbox-views';
import type { InboxViewKey } from '../lib/inbox-views';
import { InboxMessageRow } from './inbox-message-row';

const PAGE_SIZE = 50;

/**
 * The real Inbox Workspace list — `GET /inbox/messages`. The 8 named views are client-side
 * filters over the current real page (see `lib/inbox-views.ts`'s own doc comment for why: the
 * backend has no server-side category filter). There is no `Tabs` component in this design
 * system (confirmed absent) — a row of `Button` toggles is the closest existing idiom, matching
 * how filter controls are built everywhere else in this codebase.
 */
export function InboxMessageList() {
  const [view, setView] = useState<InboxViewKey>('NEEDS_ATTENTION');
  const [loadedPages, setLoadedPages] = useState(1);

  const { data, isLoading, isError, error, isFetching } = useInboxMessages({ limit: PAGE_SIZE * loadedPages, offset: 0 });

  const activeFilter = useMemo(() => INBOX_VIEWS.find((v) => v.key === view)?.filter ?? (() => true), [view]);
  const filtered = useMemo(() => (data ?? []).filter(activeFilter), [data, activeFilter]);

  return (
    <div>
      <ContextHeader title="Inbox" />
      <p className="mb-4 text-body-sm text-secondary">Replies to applications you&apos;ve sent, automatically detected and classified.</p>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter inbox messages">
        {INBOX_VIEWS.map((v) => (
          <Button key={v.key} size="sm" variant={view === v.key ? 'primary' : 'secondary'} onClick={() => setView(v.key)}>
            {v.label}
          </Button>
        ))}
      </div>

      {isLoading && (
        <SkeletonRegion loading label="Loading inbox messages">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} variant="card" />
            ))}
          </div>
        </SkeletonRegion>
      )}

      {isError && <ErrorState message={error instanceof ApiError ? error.message : 'Something went wrong loading your inbox.'} />}

      {data && filtered.length === 0 && (
        <p className={cn('rounded-md border border-dashed border-border bg-background-subtle p-6 text-body-sm text-secondary')}>
          {data.length === 0 ? "No replies detected yet — this fills in automatically once companies reply to applications you've sent." : 'No messages match this view.'}
        </p>
      )}

      {data && filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((message) => (
            <InboxMessageRow key={message.id} message={message} />
          ))}
        </ul>
      )}

      {data && data.length >= PAGE_SIZE * loadedPages && (
        <div className="mt-4 flex justify-center">
          <Button size="sm" variant="secondary" loading={isFetching} onClick={() => setLoadedPages((n) => n + 1)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
