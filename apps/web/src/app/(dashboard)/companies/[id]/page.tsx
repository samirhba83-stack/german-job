import { CompanyWorkspace } from '@/features/companies/components/company-workspace';

export default function CompanyWorkspacePage({ params }: { params: { id: string } }) {
  return <CompanyWorkspace companyId={params.id} />;
}
