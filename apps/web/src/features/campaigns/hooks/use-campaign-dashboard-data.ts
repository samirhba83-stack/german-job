'use client';

import { useQuery } from '@tanstack/react-query';
import * as campaignsApi from '../api/campaigns.api';

const DASHBOARD_FETCH_LIMIT = 100;

/**
 * Powers the Campaign Workspace Dashboard's status-bucket summary and Recent Activity list. Fetches
 * up to 100 of the authenticated candidate's own campaigns (real, server-enforced ownership scoping
 * since Milestone 24.5 — a client never needs to filter by owner itself) via the same real,
 * already-live `GET /campaigns` endpoint the plain list page uses, then computes both views
 * client-side. This mirrors the exact bounded-fetch pattern already used for Company Workspace
 * analytics ("capped at 100 to avoid an unbounded fetch," docs/company-workspace/README.md) rather
 * than inventing a new one — there is no real aggregate-count endpoint on the backend, and adding
 * one would be a Public API Contract change out of this milestone's scope. A candidate with more
 * than 100 campaigns would see an undercount here; flagged as a known limit, not silently hidden.
 */
export function useCampaignDashboardData() {
  return useQuery({
    queryKey: ['campaigns', 'dashboard', DASHBOARD_FETCH_LIMIT],
    queryFn: () => campaignsApi.listCampaigns({ page: 1, limit: DASHBOARD_FETCH_LIMIT }),
  });
}
