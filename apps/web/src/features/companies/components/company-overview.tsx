import { Card } from '@/components/ui/card';
import { DefinitionField } from '@/components/ui/definition-field';
import { humanizeStatus } from '@/lib/status-mappings';
import { formatDate, formatDateTime } from '@/lib/format-date';
import type { CompanyDto } from '../types';

/**
 * docs/company-workspace/. Company Overview — Identity/Location/Industry/Recruitment/Contact, all
 * real, directly-read `CompanyDto` fields. Name and status live in `ContextHeader`
 * (`CompanyWorkspace`'s own real `<h1>`), the same split already established for the Campaign
 * Workspace (docs/campaign-workspace/09) — this card is the supporting-fields grid underneath it.
 *
 * "Region" is deliberately not shown: the domain model and database carry a real `federalState`
 * field (docs/company-workspace/03-integration-points.md), but the backend's own response mapper
 * drops it before it ever reaches an HTTP response — there is no way to display it honestly today.
 * "Current Campaign" is also not shown — no real endpoint links a Company back to any Campaign at
 * all (verified by reading every campaign query/DTO; see the same integration-points doc).
 */
export function CompanyOverview({ company }: { company: CompanyDto }) {
  return (
    <Card padding="lg" className="space-y-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DefinitionField label="Industry" value={humanizeStatus(company.industry)} />
        <DefinitionField label="Company size" value={humanizeStatus(company.size)} />
        <DefinitionField
          label="Location"
          value={[company.location.city, company.location.country].filter(Boolean).join(', ')}
        />
        <DefinitionField label="Visa sponsorship" value={humanizeStatus(company.visaSponsorship)} />
        <DefinitionField label="Ausbildung support" value={humanizeStatus(company.ausbildungSupport)} />
        <DefinitionField label="Website" value={company.websiteUrl ?? 'Not provided'} />
        <DefinitionField label="Contact email" value={company.contact.contactEmail} />
        <DefinitionField label="Contact name" value={company.contact.contactName ?? 'Not provided'} />
        <DefinitionField label="Contact phone" value={company.contact.contactPhone ?? 'Not provided'} />
        <DefinitionField label="Added" value={formatDate(company.createdAt)} />
        <DefinitionField label="Last updated" value={formatDateTime(company.updatedAt)} />
      </dl>
      {company.metadata.description && (
        <p className="text-body-sm text-secondary">{company.metadata.description}</p>
      )}
      {company.metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {company.metadata.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-background-subtle px-2 py-0.5 text-caption text-secondary">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
