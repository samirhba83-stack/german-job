import { CampaignWorkspace } from '@/features/campaigns/components/campaign-workspace';

// Next.js 15 — `params` is now a Promise on Server Component pages (real breaking change, not a
// style preference); this page has no other data dependency, so the fix is exactly this await.
export default async function CampaignWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignWorkspace campaignId={id} />;
}
