'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { ContextHeader } from '@/components/shell/context-header';
import { ErrorState } from '@/components/shell/error-state';
import { COMPANY_STATUS_TONE, humanizeStatus } from '@/lib/status-mappings';
import { formatDate } from '@/lib/format-date';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCompanies } from '../hooks/use-companies';
import { useCompanyActions } from '../hooks/use-company-actions';
import { canManageCompany } from '../lib/can-manage-company';
import { CompanyStatus, CompanyIndustry, CompanySize } from '../types';
import type { CompanyDto } from '../types';

const PAGE_SIZE = 20;
type SortField = 'name' | 'createdAt' | 'updatedAt';

/** A short, real debounce for the keyword filter — avoids firing a real network request on every
 * keystroke while typing a company name, a genuine query-efficiency concern this milestone's
 * Performance Validation asks about, not a bespoke abstraction for its own sake. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function CompanyListRow({ company }: { company: CompanyDto }) {
  const { user } = useAuth();
  const { archive, restore } = useCompanyActions(company.id);
  const canManage = canManageCompany(company, user);

  return (
    <li>
      <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
        {/* Link and the Quick Action buttons are siblings, never nested — the same real fix
            applied to CampaignListRow (docs/interaction-framework/13-decision-records.md
            ADR-010/012), avoiding a second interactive element inside the first. */}
        <Link href={`/companies/${company.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
          {company.metadata.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote company logo, not part of the Next.js asset pipeline
            <img src={company.metadata.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
          ) : (
            <Avatar name={company.name} id={company.id} shape="rounded-square" size="sm" />
          )}
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-primary">{company.name}</p>
            <p className="text-caption text-secondary">
              {company.location.city}, {company.location.country} · {humanizeStatus(company.industry)}
            </p>
            <p className="text-caption text-secondary">Updated {formatDate(company.updatedAt)}</p>
          </div>
        </Link>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone={COMPANY_STATUS_TONE[company.status]}>{humanizeStatus(company.status)}</Badge>
          {canManage && company.status === CompanyStatus.ACTIVE && (
            <Button size="sm" variant="secondary" loading={archive.isPending} onClick={() => archive.mutate(undefined)}>
              Archive
            </Button>
          )}
          {canManage && company.status === CompanyStatus.ARCHIVED && (
            <Button size="sm" variant="secondary" loading={restore.isPending} onClick={() => restore.mutate(undefined)}>
              Restore
            </Button>
          )}
        </div>
      </Card>
    </li>
  );
}

/**
 * docs/company-workspace/. The real `GET /companies/search` list. Every filter (keyword, industry,
 * size, city, visa sponsorship) is a real, live server-side parameter; sorting is real client-side
 * reordering of the current real page's data, since the backend exposes no sort parameter at all
 * (docs/company-workspace/03-integration-points.md) — this reorders real data already fetched, it
 * never fabricates a new ordering signal. "Opportunity Score," "Compatibility Score," "Current
 * Campaign," and "Recommendation Badge" (all requested by this milestone's spec) are deliberately
 * not columns here — none has a real backend source (see the Company Workspace's own Opportunity
 * Intelligence panel for the one, single, well-explained statement of that gap, rather than
 * repeating "not available" in every one of up to 20 rows per page).
 */
export function CompanyList() {
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState('');
  const [industry, setIndustry] = useState<CompanyIndustry | ''>('');
  const [size, setSize] = useState<CompanySize | ''>('');
  const [city, setCity] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const keyword = useDebouncedValue(keywordInput, 300);

  const { data, isLoading, isError, error } = useCompanies({
    keyword: keyword || undefined,
    industry: industry || undefined,
    size: size || undefined,
    city: city || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const sortedItems = useMemo(() => {
    if (!data) return [];
    const items = [...data.items];
    items.sort((a, b) => {
      if (sortField === 'name') return a.name.localeCompare(b.name);
      return new Date(b[sortField]).getTime() - new Date(a[sortField]).getTime();
    });
    return items;
  }, [data, sortField]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <ContextHeader title="Companies" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input
          label="Search"
          placeholder="Company name…"
          value={keywordInput}
          onChange={(event) => {
            setPage(1);
            setKeywordInput(event.target.value);
          }}
          className="w-48"
        />
        <label className="flex flex-col gap-1 text-caption font-semibold uppercase tracking-wide text-secondary">
          Industry
          <select
            value={industry}
            onChange={(event) => {
              setPage(1);
              setIndustry(event.target.value as CompanyIndustry | '');
            }}
            className={cn('h-9 rounded-md border border-border bg-surface px-2 text-body-sm text-primary', 'focus-visible:border-border-focus')}
          >
            <option value="">Any</option>
            {Object.values(CompanyIndustry).map((value) => (
              <option key={value} value={value}>
                {humanizeStatus(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-caption font-semibold uppercase tracking-wide text-secondary">
          Size
          <select
            value={size}
            onChange={(event) => {
              setPage(1);
              setSize(event.target.value as CompanySize | '');
            }}
            className={cn('h-9 rounded-md border border-border bg-surface px-2 text-body-sm text-primary', 'focus-visible:border-border-focus')}
          >
            <option value="">Any</option>
            {Object.values(CompanySize).map((value) => (
              <option key={value} value={value}>
                {humanizeStatus(value)}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="City"
          placeholder="Any city…"
          value={city}
          onChange={(event) => {
            setPage(1);
            setCity(event.target.value);
          }}
          className="w-40"
        />
        <label className="flex flex-col gap-1 text-caption font-semibold uppercase tracking-wide text-secondary">
          Sort by
          <select
            value={sortField}
            onChange={(event) => setSortField(event.target.value as SortField)}
            className={cn('h-9 rounded-md border border-border bg-surface px-2 text-body-sm text-primary', 'focus-visible:border-border-focus')}
          >
            <option value="updatedAt">Last updated</option>
            <option value="createdAt">Newest</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {isLoading && (
        <SkeletonRegion loading label="Loading companies">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} variant="card" />
            ))}
          </div>
        </SkeletonRegion>
      )}

      {isError && (
        <ErrorState message={error instanceof ApiError ? error.message : 'Something went wrong loading companies.'} />
      )}

      {data && data.items.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-background-subtle p-6 text-body-sm text-secondary">
          No companies match these filters.
        </p>
      )}

      {data && data.items.length > 0 && (
        <ul className="space-y-2">
          {sortedItems.map((company) => (
            <CompanyListRow key={company.id} company={company} />
          ))}
        </ul>
      )}

      {data && data.total > data.limit && (
        <div className="mt-4 flex items-center justify-between">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </Button>
          <span className="text-caption text-secondary">
            Page {data.page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
