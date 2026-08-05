'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { humanizeStatus } from '@/lib/status-mappings';
import { CampaignStatus, CampaignStrategyType } from '../types';

export interface CampaignFilterState {
  name: string;
  status: CampaignStatus | '';
  strategyType: CampaignStrategyType | '';
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_CAMPAIGN_FILTERS: CampaignFilterState = {
  name: '',
  status: '',
  strategyType: '',
  createdFrom: '',
  createdTo: '',
};

export function hasActiveCampaignFilters(filters: CampaignFilterState): boolean {
  return Boolean(filters.name || filters.status || filters.strategyType || filters.createdFrom || filters.createdTo);
}

/**
 * Every control here maps to a real filter: `status`/`strategyType`/`createdFrom`/`createdTo` are
 * real, server-side `GET /campaigns/search` parameters; `name` is a real client-side filter over
 * real campaign names (the endpoint has no keyword field — see `use-campaigns-search.ts`). Region,
 * industry, language, execution date, health score, company, and job filters from the milestone's
 * literal spec are not built: Campaigns have no region/industry/language field, no job reference at
 * all (a Campaign targets companies, not specific jobs — a different domain concept than the spec
 * assumes), and `health` is always `null` for every real campaign, so filtering by it would only
 * ever return either everything or nothing.
 */
export function CampaignFilters({
  filters,
  onChange,
}: {
  filters: CampaignFilterState;
  onChange: (filters: CampaignFilterState) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3">
      <Input
        label="Search by name"
        value={filters.name}
        onChange={(event) => onChange({ ...filters, name: event.target.value })}
        className="w-56"
      />
      <NativeSelect
        label="Status"
        value={filters.status}
        onChange={(event) => onChange({ ...filters, status: event.target.value as CampaignStatus | '' })}
      >
        <option value="">All statuses</option>
        {Object.values(CampaignStatus).map((value) => (
          <option key={value} value={value}>
            {humanizeStatus(value)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        label="Strategy"
        value={filters.strategyType}
        onChange={(event) => onChange({ ...filters, strategyType: event.target.value as CampaignStrategyType | '' })}
      >
        <option value="">All strategies</option>
        {Object.values(CampaignStrategyType).map((value) => (
          <option key={value} value={value}>
            {humanizeStatus(value)}
          </option>
        ))}
      </NativeSelect>
      <Input
        label="Created from"
        type="date"
        value={filters.createdFrom}
        onChange={(event) => onChange({ ...filters, createdFrom: event.target.value })}
      />
      <Input
        label="Created to"
        type="date"
        value={filters.createdTo}
        onChange={(event) => onChange({ ...filters, createdTo: event.target.value })}
      />
      {hasActiveCampaignFilters(filters) && (
        <Button size="sm" variant="ghost" onClick={() => onChange(EMPTY_CAMPAIGN_FILTERS)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
