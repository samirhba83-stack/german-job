import { createHash } from 'node:crypto';
import { OAuthSecurityService } from './oauth-security.service';

describe('OAuthSecurityService', () => {
  const service = new OAuthSecurityService();

  describe('generateState', () => {
    it('produces a real CSPRNG-derived value, not a predictable/short string', () => {
      const state = service.generateState();
      expect(state.length).toBeGreaterThan(30);
    });

    it('never produces the same value twice (no fixed/static state)', () => {
      const states = new Set(Array.from({ length: 50 }, () => service.generateState()));
      expect(states.size).toBe(50);
    });
  });

  describe('generateCodeVerifier', () => {
    it('produces a verifier within RFC 7636s required 43-128 character range', () => {
      const verifier = service.generateCodeVerifier();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it('never produces the same value twice', () => {
      const verifiers = new Set(Array.from({ length: 50 }, () => service.generateCodeVerifier()));
      expect(verifiers.size).toBe(50);
    });
  });

  describe('computeCodeChallenge', () => {
    it('computes the real S256 transform (base64url(sha256(verifier)))', () => {
      const verifier = 'a-fixed-test-verifier-value-for-deterministic-hashing-1234567890';
      const expected = createHash('sha256').update(verifier).digest('base64url');
      expect(service.computeCodeChallenge(verifier)).toBe(expected);
    });

    it('is deterministic — the same verifier always produces the same challenge', () => {
      const verifier = service.generateCodeVerifier();
      expect(service.computeCodeChallenge(verifier)).toBe(service.computeCodeChallenge(verifier));
    });

    it('produces different challenges for different verifiers', () => {
      const a = service.computeCodeChallenge(service.generateCodeVerifier());
      const b = service.computeCodeChallenge(service.generateCodeVerifier());
      expect(a).not.toBe(b);
    });
  });
});
