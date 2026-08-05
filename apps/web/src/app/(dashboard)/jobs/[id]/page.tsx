import { JobListingDetail } from '@/features/jobs/components/job-listing-detail';

export default function JobDetailPage({ params }: { params: { id: string } }) {
  return <JobListingDetail jobListingId={params.id} />;
}
