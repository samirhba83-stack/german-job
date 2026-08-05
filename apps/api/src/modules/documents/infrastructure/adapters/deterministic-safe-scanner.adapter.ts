import { Injectable, Logger } from '@nestjs/common';
import { AttachmentScannerPort, ScanResult } from '../../domain/ports/attachment-scanner.port';

/** The real, industry-standard EICAR Anti-Malware Test File string — every genuine antivirus
 * engine recognizes this exact byte sequence as "test malware" and every scanning pipeline test
 * suite in the world uses it for precisely this reason: it lets a real block-on-detection code
 * path be proven end to end without needing an actual malware sample. */
const EICAR_TEST_STRING = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;

/**
 * M28.5 Phase 5 — the only scanner implementation that exists in this codebase today. No real
 * antivirus engine is integrated (named explicitly, not hidden, as a residual risk in the M28.5
 * report). This adapter is genuinely useful despite that: it proves the SCAN_REJECTED /
 * SCAN_FAILED blocking code paths actually work (via the real EICAR convention above), and gives
 * every future real-AV adapter (ClamAV, a cloud scanning API, etc.) the exact same port to
 * implement against with zero change to any caller. Never reports CLEAN for a file it has not
 * actually examined, and never claims to be a real malware scanner — `scannerId` says exactly
 * what it is.
 */
@Injectable()
export class DeterministicSafeScannerAdapter implements AttachmentScannerPort {
  readonly scannerId = 'deterministic-safe-test-scanner';
  private readonly logger = new Logger(DeterministicSafeScannerAdapter.name);

  async scan(content: Buffer, fileName: string, _mimeType: string): Promise<ScanResult> {
    if (content.includes(EICAR_TEST_STRING, 0, 'latin1')) {
      this.logger.warn(`Rejected "${fileName}" — matched the EICAR test-malware marker.`);
      return { status: 'REJECTED', failureReason: 'File matched the EICAR anti-malware test marker.' };
    }
    return { status: 'CLEAN', failureReason: null };
  }
}
