import { CampaignReasonCode } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface CampaignReasonProps {
  code: CampaignReasonCode;
  note: string | null;
}

const MAX_NOTE_LENGTH = 1000;

export class CampaignReason extends ValueObject<CampaignReasonProps> {
  private constructor(props: CampaignReasonProps) {
    super(props);
  }

  get code(): CampaignReasonCode {
    return this.props.code;
  }

  get note(): string | null {
    return this.props.note;
  }

  static create(code: CampaignReasonCode, note?: string | null): CampaignReason {
    const trimmedNote = note?.trim() || null;
    if (trimmedNote && trimmedNote.length > MAX_NOTE_LENGTH) {
      throw new Error(`Campaign reason note exceeds ${MAX_NOTE_LENGTH} characters`);
    }
    return new CampaignReason({ code, note: trimmedNote });
  }
}
