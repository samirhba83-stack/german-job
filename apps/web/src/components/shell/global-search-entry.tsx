'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * docs/interaction-framework/01-application-shell.md §Global Search Entry. There is no single
 * cross-resource search endpoint in the backend (docs/frontend-architecture/06-api-consumption-
 * architecture.md) — companies, jobs, campaigns, and applications each have their own `search`
 * endpoint. This entry point targets Jobs search by default (the most common global-search intent
 * on a job platform, and one of the two public, unauthenticated search endpoints alongside
 * Companies) rather than inventing a unified search API the backend doesn't have.
 *
 * `variant="mobile"` fixes a real gap found in Milestone 22.2's self-review: the original
 * `hidden md:flex` version was completely unreachable below the `md` breakpoint — there was no
 * way to search at all on a phone. See global-header.tsx for the toggle that renders this variant.
 */
export function GlobalSearchEntry({ variant = 'desktop', autoFocus = false }: { variant?: 'desktop' | 'mobile'; autoFocus?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/jobs?keyword=${encodeURIComponent(query.trim())}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn(variant === 'desktop' ? 'hidden max-w-sm flex-1 md:flex' : 'flex w-full')}
    >
      <label htmlFor={`global-search-${variant}`} className="sr-only">
        Search jobs
      </label>
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" aria-hidden="true" strokeWidth={1.75} />
        <input
          id={`global-search-${variant}`}
          type="search"
          placeholder="Search jobs..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus={autoFocus}
          className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-body-sm text-primary placeholder:text-disabled focus-visible:border-border-focus"
        />
      </div>
    </form>
  );
}
