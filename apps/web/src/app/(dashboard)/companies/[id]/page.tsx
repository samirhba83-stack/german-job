import { CompanyWorkspace } from '@/features/companies/components/company-workspace';

// Next.js 15 — `params` is now a Promise on Server Component pages (real breaking change).
export default async function CompanyWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyWorkspace companyId={id} />;
}
