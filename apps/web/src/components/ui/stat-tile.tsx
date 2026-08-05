export interface StatTileProps {
  label: string;
  value: string;
}

/**
 * A single labeled real number/ratio, used by any workspace's Analytics section. Extracted during
 * Milestone 24's "no duplicated logic" audit — `OperationalAnalytics` (Campaign Workspace) and
 * `CompanyAnalytics` (Company Workspace) had each independently defined an identical local
 * component. `tabular-nums` keeps digits aligned when several tiles sit in a grid together.
 */
export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-caption font-semibold uppercase tracking-wide text-secondary">{label}</p>
      <p className="mt-1 text-heading-lg font-semibold text-primary tabular-nums">{value}</p>
    </div>
  );
}
