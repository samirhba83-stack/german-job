import {
  CompanyStatus,
  CompanyIndustry,
  CompanySize,
  VisaSponsorship,
  AusbildungSupport,
} from '@german-job-engine/shared-types';
import { AggregateRoot } from '../../../../shared/domain';
import { CompanyId } from '../value-objects/company-id.vo';
import { CompanyLocation } from '../value-objects/company-location.vo';
import { CompanyWebsite } from '../value-objects/company-website.vo';
import { CompanyContact } from '../value-objects/company-contact.vo';
import { HiringQuality } from '../value-objects/hiring-quality.vo';
import { TrustScore } from '../value-objects/trust-score.vo';
import { CompanyMetadata } from '../value-objects/company-metadata.vo';
import { CompanyCreatedEvent } from '../events/company-created.event';
import { CompanyUpdatedEvent } from '../events/company-updated.event';
import { CompanyArchivedEvent } from '../events/company-archived.event';
import { CompanyRestoredEvent } from '../events/company-restored.event';
import { CompanyAlreadyArchivedException } from '../exceptions/company-already-archived.exception';
import { CompanyNotArchivedException } from '../exceptions/company-not-archived.exception';

export interface CompanyProps {
  ownerId: string;
  name: string;
  status: CompanyStatus;
  industry: CompanyIndustry;
  size: CompanySize;
  location: CompanyLocation;
  website: CompanyWebsite | null;
  contact: CompanyContact;
  visaSponsorship: VisaSponsorship;
  ausbildungSupport: AusbildungSupport;
  hiringQuality: HiringQuality | null;
  trustScore: TrustScore | null;
  metadata: CompanyMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyUpdate {
  name?: string;
  industry?: CompanyIndustry;
  size?: CompanySize;
  location?: CompanyLocation;
  website?: CompanyWebsite | null;
  contact?: CompanyContact;
  visaSponsorship?: VisaSponsorship;
  ausbildungSupport?: AusbildungSupport;
  metadata?: CompanyMetadata;
}

export class Company extends AggregateRoot<string> {
  private props: CompanyProps;

  private constructor(id: string, props: CompanyProps) {
    super(id);
    CompanyId.create(id);

    if (!props.name.trim()) {
      throw new Error('Company requires a name');
    }

    this.props = props;
  }

  get companyId(): CompanyId {
    return CompanyId.create(this.id);
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get name(): string {
    return this.props.name;
  }

  get status(): CompanyStatus {
    return this.props.status;
  }

  get industry(): CompanyIndustry {
    return this.props.industry;
  }

  get size(): CompanySize {
    return this.props.size;
  }

  get location(): CompanyLocation {
    return this.props.location;
  }

  get website(): CompanyWebsite | null {
    return this.props.website;
  }

  get contact(): CompanyContact {
    return this.props.contact;
  }

  get visaSponsorship(): VisaSponsorship {
    return this.props.visaSponsorship;
  }

  get ausbildungSupport(): AusbildungSupport {
    return this.props.ausbildungSupport;
  }

  get hiringQuality(): HiringQuality | null {
    return this.props.hiringQuality;
  }

  get trustScore(): TrustScore | null {
    return this.props.trustScore;
  }

  get metadata(): CompanyMetadata {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === CompanyStatus.ACTIVE;
  }

  isArchived(): boolean {
    return this.props.status === CompanyStatus.ARCHIVED;
  }

  /** Registers a brand-new active company profile and raises the corresponding domain event. */
  static create(
    id: string,
    ownerId: string,
    props: {
      name: string;
      industry: CompanyIndustry;
      size: CompanySize;
      location: CompanyLocation;
      website?: CompanyWebsite | null;
      contact: CompanyContact;
      visaSponsorship?: VisaSponsorship;
      ausbildungSupport?: AusbildungSupport;
      metadata?: CompanyMetadata;
    },
  ): Company {
    const now = new Date();
    const company = new Company(id, {
      ownerId,
      name: props.name,
      status: CompanyStatus.ACTIVE,
      industry: props.industry,
      size: props.size,
      location: props.location,
      website: props.website ?? null,
      contact: props.contact,
      visaSponsorship: props.visaSponsorship ?? VisaSponsorship.NOT_OFFERED,
      ausbildungSupport: props.ausbildungSupport ?? AusbildungSupport.NOT_OFFERED,
      hiringQuality: null,
      trustScore: null,
      metadata: props.metadata ?? CompanyMetadata.empty(),
      createdAt: now,
      updatedAt: now,
    });
    company.addDomainEvent(new CompanyCreatedEvent(id, ownerId));
    return company;
  }

  /** Rehydrates a Company from persistence without re-raising domain events. */
  static reconstitute(id: string, props: CompanyProps): Company {
    return new Company(id, props);
  }

  /** Applies a partial set of changes — only provided fields are updated. Status is not settable here. */
  update(changes: CompanyUpdate): void {
    if (changes.name !== undefined) {
      if (!changes.name.trim()) {
        throw new Error('Company requires a name');
      }
      this.props.name = changes.name;
    }
    if (changes.industry !== undefined) this.props.industry = changes.industry;
    if (changes.size !== undefined) this.props.size = changes.size;
    if (changes.location !== undefined) this.props.location = changes.location;
    if (changes.website !== undefined) this.props.website = changes.website;
    if (changes.contact !== undefined) this.props.contact = changes.contact;
    if (changes.visaSponsorship !== undefined) this.props.visaSponsorship = changes.visaSponsorship;
    if (changes.ausbildungSupport !== undefined) this.props.ausbildungSupport = changes.ausbildungSupport;
    if (changes.metadata !== undefined) this.props.metadata = changes.metadata;

    this.touch();
    this.addDomainEvent(new CompanyUpdatedEvent(this.id));
  }

  archive(): void {
    if (this.isArchived()) {
      throw new CompanyAlreadyArchivedException(this.id);
    }

    this.props.status = CompanyStatus.ARCHIVED;
    this.touch();
    this.addDomainEvent(new CompanyArchivedEvent(this.id));
  }

  restore(): void {
    if (!this.isArchived()) {
      throw new CompanyNotArchivedException(this.id);
    }

    this.props.status = CompanyStatus.ACTIVE;
    this.touch();
    this.addDomainEvent(new CompanyRestoredEvent(this.id));
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
