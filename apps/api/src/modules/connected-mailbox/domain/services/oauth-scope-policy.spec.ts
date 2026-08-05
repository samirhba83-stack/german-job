import { validateGrantedScopes, requiredScopesFor, GOOGLE_GMAIL_REQUIRED_SCOPES, MICROSOFT_OUTLOOK_REQUIRED_SCOPES } from './oauth-scope-policy';

describe('requiredScopesFor', () => {
  it('returns the exact minimal Gmail scope set', () => {
    expect(requiredScopesFor('GOOGLE_GMAIL')).toEqual(['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email', 'openid']);
  });

  it('returns the exact minimal Outlook scope set', () => {
    expect(requiredScopesFor('MICROSOFT_OUTLOOK')).toEqual(['Mail.Send', 'User.Read', 'offline_access', 'openid']);
  });
});

describe('validateGrantedScopes', () => {
  it('accepts exactly the required Gmail scopes, nothing more nothing less', () => {
    const result = validateGrantedScopes('GOOGLE_GMAIL', [...GOOGLE_GMAIL_REQUIRED_SCOPES]);
    expect(result).toEqual({ accepted: true, missingRequiredScopes: [], unexpectedScopes: [] });
  });

  it('accepts exactly the required Outlook scopes, nothing more nothing less', () => {
    const result = validateGrantedScopes('MICROSOFT_OUTLOOK', [...MICROSOFT_OUTLOOK_REQUIRED_SCOPES]);
    expect(result).toEqual({ accepted: true, missingRequiredScopes: [], unexpectedScopes: [] });
  });

  it('rejects a Gmail grant missing a required scope', () => {
    const result = validateGrantedScopes('GOOGLE_GMAIL', ['https://www.googleapis.com/auth/gmail.send', 'openid']);
    expect(result.accepted).toBe(false);
    expect(result.missingRequiredScopes).toEqual(['https://www.googleapis.com/auth/userinfo.email']);
    expect(result.unexpectedScopes).toEqual([]);
  });

  it('rejects a Gmail grant that includes an unexpected broader scope (e.g. full mailbox modify)', () => {
    const result = validateGrantedScopes('GOOGLE_GMAIL', [...GOOGLE_GMAIL_REQUIRED_SCOPES, 'https://www.googleapis.com/auth/gmail.modify']);
    expect(result.accepted).toBe(false);
    expect(result.missingRequiredScopes).toEqual([]);
    expect(result.unexpectedScopes).toEqual(['https://www.googleapis.com/auth/gmail.modify']);
  });

  it('rejects a Gmail grant that includes userinfo.profile even though it sounds harmless (deliberately excluded scope)', () => {
    const result = validateGrantedScopes('GOOGLE_GMAIL', [...GOOGLE_GMAIL_REQUIRED_SCOPES, 'https://www.googleapis.com/auth/userinfo.profile']);
    expect(result.accepted).toBe(false);
    expect(result.unexpectedScopes).toEqual(['https://www.googleapis.com/auth/userinfo.profile']);
  });

  it('rejects an Outlook grant missing offline_access (no refresh token would ever be issued)', () => {
    const result = validateGrantedScopes('MICROSOFT_OUTLOOK', ['Mail.Send', 'User.Read', 'openid']);
    expect(result.accepted).toBe(false);
    expect(result.missingRequiredScopes).toEqual(['offline_access']);
  });

  it('rejects an Outlook grant with an unexpected broader scope (e.g. Mail.ReadWrite)', () => {
    const result = validateGrantedScopes('MICROSOFT_OUTLOOK', [...MICROSOFT_OUTLOOK_REQUIRED_SCOPES, 'Mail.ReadWrite']);
    expect(result.accepted).toBe(false);
    expect(result.unexpectedScopes).toEqual(['Mail.ReadWrite']);
  });

  it('rejects an empty scope grant', () => {
    const result = validateGrantedScopes('GOOGLE_GMAIL', []);
    expect(result.accepted).toBe(false);
    expect(result.missingRequiredScopes.length).toBe(3);
  });

  it('reports every missing scope at once, not just the first (accumulates rather than short-circuits)', () => {
    const result = validateGrantedScopes('MICROSOFT_OUTLOOK', []);
    expect(result.missingRequiredScopes).toEqual(['Mail.Send', 'User.Read', 'offline_access', 'openid']);
  });
});
