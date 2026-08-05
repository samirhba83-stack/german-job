import { ValueObject } from '../../../../shared/domain';

interface EvidenceReferenceProps {
  type: string;
  externalId: string;
  url: string | null;
}

/** Placeholder pointer to proof — never the proof itself. No storage/retrieval logic here. */
export class EvidenceReference extends ValueObject<EvidenceReferenceProps> {
  private constructor(props: EvidenceReferenceProps) {
    super(props);
  }

  get type(): string {
    return this.props.type;
  }

  get externalId(): string {
    return this.props.externalId;
  }

  get url(): string | null {
    return this.props.url;
  }

  static create(props: { type: string; externalId: string; url?: string | null }): EvidenceReference {
    const type = props.type.trim();
    const externalId = props.externalId.trim();
    if (!type) {
      throw new Error('Evidence reference requires a type');
    }
    if (!externalId) {
      throw new Error('Evidence reference requires an external id');
    }
    return new EvidenceReference({ type, externalId, url: props.url?.trim() || null });
  }
}
