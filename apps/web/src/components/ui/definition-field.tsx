export interface DefinitionFieldProps {
  label: string;
  value: string;
}

/**
 * A single labeled value in a workspace Overview card's `<dl>` grid. Extracted during Milestone
 * 24's live validation — `CampaignOverview` and `CompanyOverview` had each independently defined
 * an identical local `OverviewField` component, and both shared the same real bug: no `break-words`
 * on the value, so a long unbroken string (an email address, in the case that surfaced this)
 * overflowed its grid cell and visually collided with the adjacent column at narrow (mobile)
 * viewport widths — only reproducible by actually rendering the page at a real mobile width, not
 * by reading the code. `break-words` (CSS `overflow-wrap: break-word`) lets the value wrap onto a
 * second line instead of overflowing.
 */
export function DefinitionField({ label, value }: DefinitionFieldProps) {
  return (
    <div>
      <dt className="text-caption font-semibold uppercase tracking-wide text-secondary">{label}</dt>
      <dd className="mt-0.5 break-words text-body-sm text-primary">{value}</dd>
    </div>
  );
}
