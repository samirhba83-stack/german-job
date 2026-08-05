import { DocumentScanStatus } from '../models/document-type';

export const ATTACHMENT_SCANNER_PORT = Symbol('ATTACHMENT_SCANNER_PORT');

export interface ScanResult {
  readonly status: DocumentScanStatus;
  readonly failureReason: string | null;
}

/**
 * M28.5 Phase 5 — a real scanning abstraction, future-antivirus-integration-shaped, but honest
 * about what actually runs today: no real AV engine is wired into this codebase. The deterministic
 * safe test adapter (`DeterministicSafeScannerAdapter`) is the only implementation that exists —
 * it is a real, useful safety boundary (a well-known synthetic "this file is malicious" test
 * marker is always rejected, matching the industry-standard EICAR test-file convention used to
 * verify a scanning pipeline actually runs without needing real malware), but it is NOT a
 * substitute for a real AV engine. This is named, not hidden, as a residual risk in the M28.5
 * report — never claim a file was scanned by a real engine when only this test adapter ran
 * (Phase 5: "Never claim files were scanned when no scanner ran").
 */
export interface AttachmentScannerPort {
  readonly scannerId: string;
  scan(content: Buffer, fileName: string, mimeType: string): Promise<ScanResult>;
}
