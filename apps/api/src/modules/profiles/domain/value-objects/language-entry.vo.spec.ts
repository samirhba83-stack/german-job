import { LanguageProficiency } from '@german-job-engine/shared-types';
import { LanguageEntry } from './language-entry.vo';

describe('LanguageEntry', () => {
  it('trims the language name', () => {
    const entry = LanguageEntry.create('  English  ', LanguageProficiency.FLUENT);

    expect(entry.language).toBe('English');
    expect(entry.proficiency).toBe(LanguageProficiency.FLUENT);
  });

  it('rejects a blank language name', () => {
    expect(() => LanguageEntry.create('   ', LanguageProficiency.BASIC)).toThrow(/language name/);
  });
});
