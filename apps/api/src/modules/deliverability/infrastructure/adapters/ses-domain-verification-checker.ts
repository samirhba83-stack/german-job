import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, GetIdentityVerificationAttributesCommand, GetIdentityDkimAttributesCommand } from '@aws-sdk/client-ses';

export interface DomainVerificationCheckResult {
  readonly verified: boolean;
  readonly dkimVerified: boolean;
  readonly detail: string;
}

/**
 * M28.5 Phase 10 — a REAL provider-API-backed domain verification check for SES, using the
 * already-present `@aws-sdk/client-ses` dependency. `GetIdentityVerificationAttributes` and
 * `GetIdentityDkimAttributes` are SES's own authoritative signals for domain ownership and DKIM
 * signing readiness respectively — this never invents a result (Non-Negotiable Principle #11);
 * if the API call itself fails, this reports `verified: false` with the real error, never a
 * guessed "probably fine."
 *
 * SPF/DMARC readiness are deliberately NOT derived here — SES's identity-verification API does
 * not expose either as a simple attribute (they are DNS-record-level concerns SES itself doesn't
 * centrally track), so this application does not fabricate a DNS-based check for them; an admin
 * records SPF/DMARC readiness explicitly after confirming their own DNS configuration (Admin
 * Operations, M28.5 report). Resend/SendGrid/SMTP have no equivalent real checker implemented in
 * this milestone — a named, honest scope boundary (Known Limitations), not silently assumed.
 */
@Injectable()
export class SesDomainVerificationChecker {
  private readonly logger = new Logger(SesDomainVerificationChecker.name);
  private client: SESClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): SESClient {
    if (this.client) return this.client;
    this.client = new SESClient({
      region: this.config.get<string>('emailInfrastructure.ses.region', ''),
      credentials: {
        accessKeyId: this.config.get<string>('emailInfrastructure.ses.accessKeyId', ''),
        secretAccessKey: this.config.get<string>('emailInfrastructure.ses.secretAccessKey', ''),
      },
    });
    return this.client;
  }

  async checkDomain(domain: string): Promise<DomainVerificationCheckResult> {
    try {
      const client = this.getClient();
      const [verificationResult, dkimResult] = await Promise.all([
        client.send(new GetIdentityVerificationAttributesCommand({ Identities: [domain] })),
        client.send(new GetIdentityDkimAttributesCommand({ Identities: [domain] })),
      ]);

      const verificationStatus = verificationResult.VerificationAttributes?.[domain]?.VerificationStatus;
      const dkimStatus = dkimResult.DkimAttributes?.[domain]?.DkimVerificationStatus;
      const dkimEnabled = dkimResult.DkimAttributes?.[domain]?.DkimEnabled ?? false;

      return {
        verified: verificationStatus === 'Success',
        dkimVerified: dkimStatus === 'Success' && dkimEnabled,
        detail: `SES reports domain verification "${verificationStatus ?? 'NotFound'}", DKIM "${dkimStatus ?? 'NotFound'}" (enabled: ${dkimEnabled}).`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SES domain verification check failed for "${domain}": ${message}`);
      return { verified: false, dkimVerified: false, detail: `Could not reach SES to check domain verification: ${message}` };
    }
  }
}
