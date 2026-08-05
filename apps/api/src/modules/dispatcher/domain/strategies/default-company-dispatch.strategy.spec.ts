import { DefaultCompanyDispatchStrategy } from './default-company-dispatch.strategy';

describe('DefaultCompanyDispatchStrategy', () => {
  it('resolves a neutral profile carrying the given companyId', () => {
    const profile = new DefaultCompanyDispatchStrategy().resolve('company-42');

    expect(profile.companyId).toBe('company-42');
    expect(profile.preferredSendHourRange).toBeNull();
    expect(profile.explanation).toBeTruthy();
  });
});
