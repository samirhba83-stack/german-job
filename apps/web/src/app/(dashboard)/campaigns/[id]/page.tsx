import { CampaignWorkspace } from '@/features/campaigns/components/campaign-workspace';

export default function CampaignWorkspacePage({ params }: { params: { id: string } }) {
  return <CampaignWorkspace campaignId={params.id} />;
}
