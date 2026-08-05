import { LanguageProficiency } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface LanguageEntryProps {
  language: string;
  proficiency: LanguageProficiency;
}

export class LanguageEntry extends ValueObject<LanguageEntryProps> {
  private constructor(props: LanguageEntryProps) {
    super(props);
  }

  get language(): string {
    return this.props.language;
  }

  get proficiency(): LanguageProficiency {
    return this.props.proficiency;
  }

  static create(language: string, proficiency: LanguageProficiency): LanguageEntry {
    const normalized = language.trim();
    if (!normalized) {
      throw new Error('Language entry requires a language name');
    }

    return new LanguageEntry({ language: normalized, proficiency });
  }
}
