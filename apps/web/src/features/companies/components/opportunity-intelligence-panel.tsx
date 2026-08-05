/**
 * docs/company-workspace/. Section 3, Opportunity Intelligence. The milestone asks for an
 * Opportunity Score, Confidence Score, Compatibility Score, Priority, Reasoning, Business
 * Explanation, Evidence, and Recommended Next Action for every company.
 *
 * None of this exists on the real backend today — and unlike Campaign's `intelligence` field
 * (a real, if always-null, reserved DTO shape), `CompanyDto` has no intelligence field of any kind
 * at all. There is no per-(candidate,company) compatibility/match-score computation anywhere in
 * this codebase (verified by an exhaustive repo-wide search during this milestone's research
 * pass — docs/company-workspace/03-integration-points.md), and the `recommendations` /
 * `decision-intelligence` modules that would compute this have zero HTTP surface.
 *
 * "Never expose unexplained scores. Every score must explain itself" — this panel honors that
 * literally: rather than show a fabricated number with a fabricated explanation bolted on, it
 * explains clearly that no score exists to show.
 */
export function OpportunityIntelligencePanel() {
  return (
    <div className="rounded-md border border-dashed border-border bg-background-subtle p-4 text-body-sm text-secondary">
      Opportunity intelligence isn&apos;t available yet — no scoring or recommendation engine has a live backend
      surface today. This panel will show a real, evidence-backed opportunity score, compatibility score, and
      recommended next action the moment that capability exists; nothing here is estimated or invented in the
      meantime.
    </div>
  );
}
