import { JobListingDetail } from '@/features/jobs/components/job-listing-detail';

// Next.js 15 — `params` is now a Promise on Server Component pages (real breaking change).
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobListingDetail jobListingId={id} />;
}
