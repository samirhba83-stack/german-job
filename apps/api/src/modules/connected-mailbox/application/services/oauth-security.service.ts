import { randomBytes, createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/**
 * M28.6 Phase 5 — real OAuth security primitives. `state` is 32 bytes of real CSPRNG output
 * (`crypto.randomBytes`, not `Math.random`); the PKCE `codeVerifier` is 64 bytes, base64url-
 * encoded to ~86 characters — comfortably within RFC 7636's required 43–128 character range;
 * `codeChallenge` is the real S256 transform (`base64url(sha256(verifier))`) both Google and
 * Microsoft's identity platforms accept.
 */
@Injectable()
export class OAuthSecurityService {
  generateState(): string {
    return randomBytes(32).toString('base64url');
  }

  generateCodeVerifier(): string {
    return randomBytes(64).toString('base64url');
  }

  computeCodeChallenge(codeVerifier: string): string {
    return createHash('sha256').update(codeVerifier).digest('base64url');
  }
}
