import { DeterministicApplicationAssemblyStrategy } from './deterministic-application-assembly.strategy';
import { ApplicationAssemblyInput } from '../models/application-assembly-input';
import { CandidateDocumentCandidate } from '../models/candidate-document-candidate';
import { ApplicationAssemblyConfig, DEFAULT_APPLICATION_ASSEMBLY_CONFIG } from '../application-assembly-config';

const NOW = new Date('2026-01-05T10:00:00.000Z');

function buildDocument(id: string, overrides: Partial<CandidateDocumentCandidate> = {}): CandidateDocumentCandidate {
  return {
    id,
    fileName: `${id}.pdf`,
    documentReference: id,
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    uploadedAt: NOW,
    ...overrides,
  };
}

function buildInput(overrides: Partial<ApplicationAssemblyInput> = {}): ApplicationAssemblyInput {
  return {
    applicationId: 'application-1',
    candidateIdentity: { displayName: 'jane.doe', emailAddress: 'jane.doe@example.com', displayNameSource: 'EMAIL_LOCAL_PART' },
    recipientIdentity: { displayName: 'HR Team', emailAddress: 'hr@company.example', companyName: 'Acme GmbH' },
    documents: { cvCandidates: [], motivationLetterCandidates: [], certificateCandidates: [] },
    jobTitle: 'Software Engineer',
    ...overrides,
  };
}

describe('DeterministicApplicationAssemblyStrategy', () => {
  const strategy = new DeterministicApplicationAssemblyStrategy(DEFAULT_APPLICATION_ASSEMBLY_CONFIG);

  describe('single CV selection', () => {
    it('selects the only available CV', () => {
      const cv = buildDocument('cv-1');
      const input = buildInput({ documents: { cvCandidates: [cv], motivationLetterCandidates: [], certificateCandidates: [] } });

      const pkg = strategy.assemble(input, NOW);

      expect(pkg.selectedCv).toEqual(cv);
      expect(pkg.rejectedCvs).toEqual([]);
    });

    it('selects null and explains why when no CV is available', () => {
      const pkg = strategy.assemble(buildInput(), NOW);

      expect(pkg.selectedCv).toBeNull();
      expect(pkg.rejectedCvs).toEqual([]);
      expect(pkg.assemblyReasoning).toContain('No CV is available');
    });
  });

  describe('multiple CV selection', () => {
    it('selects the most recently uploaded CV and rejects the rest', () => {
      const older = buildDocument('cv-older', { uploadedAt: new Date('2025-01-01T00:00:00.000Z') });
      const newest = buildDocument('cv-newest', { uploadedAt: new Date('2026-01-01T00:00:00.000Z') });
      const middle = buildDocument('cv-middle', { uploadedAt: new Date('2025-06-01T00:00:00.000Z') });
      const input = buildInput({ documents: { cvCandidates: [older, newest, middle], motivationLetterCandidates: [], certificateCandidates: [] } });

      const pkg = strategy.assemble(input, NOW);

      expect(pkg.selectedCv).toEqual(newest);
      expect(pkg.rejectedCvs).toHaveLength(2);
      expect(pkg.rejectedCvs.map((r) => r.document.id).sort()).toEqual(['cv-middle', 'cv-older']);
      expect(pkg.rejectedCvs.every((r) => r.reasonCode === 'NOT_MOST_RECENT')).toBe(true);
    });

    it('breaks an exact uploadedAt tie deterministically by id', () => {
      const cvB = buildDocument('cv-b');
      const cvA = buildDocument('cv-a');
      const input = buildInput({ documents: { cvCandidates: [cvB, cvA], motivationLetterCandidates: [], certificateCandidates: [] } });

      const pkg = strategy.assemble(input, NOW);

      expect(pkg.selectedCv?.id).toBe('cv-a');
    });
  });

  describe('certificate filtering', () => {
    it('keeps all certificates when under the configured limit', () => {
      const certs = [buildDocument('cert-1'), buildDocument('cert-2')];
      const input = buildInput({ documents: { cvCandidates: [], motivationLetterCandidates: [], certificateCandidates: certs } });

      const pkg = strategy.assemble(input, NOW);

      expect(pkg.selectedCertificates).toHaveLength(2);
      expect(pkg.omittedCertificates).toEqual([]);
    });

    it('omits certificates beyond the configured limit, most-recent-first', () => {
      const config: ApplicationAssemblyConfig = { maxCertificates: 2 };
      const limitedStrategy = new DeterministicApplicationAssemblyStrategy(config);
      const certs = [
        buildDocument('cert-1', { uploadedAt: new Date('2025-01-01T00:00:00.000Z') }),
        buildDocument('cert-2', { uploadedAt: new Date('2026-01-01T00:00:00.000Z') }),
        buildDocument('cert-3', { uploadedAt: new Date('2025-06-01T00:00:00.000Z') }),
      ];
      const input = buildInput({ documents: { cvCandidates: [], motivationLetterCandidates: [], certificateCandidates: certs } });

      const pkg = limitedStrategy.assemble(input, NOW);

      expect(pkg.selectedCertificates.map((c) => c.id)).toEqual(['cert-2', 'cert-3']);
      expect(pkg.omittedCertificates).toHaveLength(1);
      expect(pkg.omittedCertificates[0].document.id).toBe('cert-1');
      expect(pkg.omittedCertificates[0].reasonCode).toBe('CERTIFICATE_LIMIT_EXCEEDED');
    });
  });

  describe('attachment ordering', () => {
    it('orders the CV first, followed by selected certificates', () => {
      const cv = buildDocument('cv-1');
      const cert1 = buildDocument('cert-1', { uploadedAt: new Date('2026-01-01T00:00:00.000Z') });
      const cert2 = buildDocument('cert-2', { uploadedAt: new Date('2025-01-01T00:00:00.000Z') });
      const input = buildInput({ documents: { cvCandidates: [cv], motivationLetterCandidates: [], certificateCandidates: [cert2, cert1] } });

      const pkg = strategy.assemble(input, NOW);

      expect(pkg.attachments.map((a) => a.category)).toEqual(['CV', 'CERTIFICATE', 'CERTIFICATE']);
      expect(pkg.attachments.map((a) => a.fileName)).toEqual(['cv-1.pdf', 'cert-1.pdf', 'cert-2.pdf']);
    });

    it('maps document fields onto attachment fields (contentReference from the real document id, never a raw URL/path)', () => {
      const cv = buildDocument('cv-1', { documentReference: 'cv-1', mimeType: 'application/pdf', sizeBytes: 2048 });
      const input = buildInput({ documents: { cvCandidates: [cv], motivationLetterCandidates: [], certificateCandidates: [] } });

      const pkg = strategy.assemble(input, NOW);

      expect(pkg.attachments[0]).toEqual({
        fileName: 'cv-1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        contentReference: 'cv-1',
        category: 'CV',
      });
    });

    it('includes a motivation letter attachment ordered between the CV and certificates', () => {
      const cv = buildDocument('cv-1');
      const letter = buildDocument('letter-1', { fileName: 'letter-1.pdf' });
      const cert = buildDocument('cert-1');
      const input = buildInput({ documents: { cvCandidates: [cv], motivationLetterCandidates: [letter], certificateCandidates: [cert] } });

      const pkg = strategy.assemble(input, NOW);

      expect(pkg.attachments.map((a) => a.category)).toEqual(['CV', 'MOTIVATION_LETTER', 'CERTIFICATE']);
      expect(pkg.motivationLetterSource).toBe('CANDIDATE_PROVIDED');
    });
  });

  describe('empty attachment handling', () => {
    it('produces an empty attachment list when no CV or certificates exist', () => {
      const pkg = strategy.assemble(buildInput(), NOW);

      expect(pkg.attachments).toEqual([]);
      expect(pkg.selectedCv).toBeNull();
      expect(pkg.selectedCertificates).toEqual([]);
    });
  });

  describe('deterministic package creation', () => {
    it('produces an identical package for the same input and instant', () => {
      const input = buildInput({
        documents: { cvCandidates: [buildDocument('cv-1'), buildDocument('cv-2')], motivationLetterCandidates: [], certificateCandidates: [buildDocument('cert-1')] },
      });

      const first = strategy.assemble(input, NOW);
      const second = strategy.assemble(input, NOW);

      expect(first).toEqual(second);
    });
  });

  describe('explainability', () => {
    it('exposes candidate identity, recipient identity, motivation letter source, timestamp, and reasoning', () => {
      const input = buildInput();

      const pkg = strategy.assemble(input, NOW);

      expect(pkg.applicationId).toBe('application-1');
      expect(pkg.assembledAt).toBe(NOW);
      expect(pkg.candidateIdentity).toEqual(input.candidateIdentity);
      expect(pkg.recipientIdentity).toEqual(input.recipientIdentity);
      expect(pkg.motivationLetterSource).toBe('NOT_AVAILABLE');
      expect(pkg.assemblyReasoning).toEqual(expect.any(String));
      expect(pkg.assemblyReasoning.length).toBeGreaterThan(0);
    });

    it('explains each rejected CV and omitted certificate individually', () => {
      const config: ApplicationAssemblyConfig = { maxCertificates: 1 };
      const limitedStrategy = new DeterministicApplicationAssemblyStrategy(config);
      const input = buildInput({
        documents: {
          cvCandidates: [buildDocument('cv-old', { uploadedAt: new Date('2025-01-01T00:00:00.000Z') }), buildDocument('cv-new')],
          motivationLetterCandidates: [],
          certificateCandidates: [buildDocument('cert-a'), buildDocument('cert-b', { uploadedAt: new Date('2025-01-01T00:00:00.000Z') })],
        },
      });

      const pkg = limitedStrategy.assemble(input, NOW);

      expect(pkg.rejectedCvs[0].explanation).toContain('cv-old.pdf');
      expect(pkg.omittedCertificates[0].explanation).toContain('.pdf');
    });
  });

  describe('dependency injection / configuration-driven behavior', () => {
    it('changes the certificate cutoff purely via injected config', () => {
      const certs = [buildDocument('cert-1'), buildDocument('cert-2'), buildDocument('cert-3')];
      const input = buildInput({ documents: { cvCandidates: [], motivationLetterCandidates: [], certificateCandidates: certs } });

      const permissiveStrategy = new DeterministicApplicationAssemblyStrategy({ maxCertificates: 10 });
      const restrictiveStrategy = new DeterministicApplicationAssemblyStrategy({ maxCertificates: 1 });

      expect(permissiveStrategy.assemble(input, NOW).selectedCertificates).toHaveLength(3);
      expect(restrictiveStrategy.assemble(input, NOW).selectedCertificates).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('handles zero maxCertificates by omitting every certificate', () => {
      const zeroStrategy = new DeterministicApplicationAssemblyStrategy({ maxCertificates: 0 });
      const certs = [buildDocument('cert-1')];
      const input = buildInput({ documents: { cvCandidates: [], motivationLetterCandidates: [], certificateCandidates: certs } });

      const pkg = zeroStrategy.assemble(input, NOW);

      expect(pkg.selectedCertificates).toEqual([]);
      expect(pkg.omittedCertificates).toHaveLength(1);
    });

    it('handles neither CV nor certificates being available at all', () => {
      const pkg = strategy.assemble(buildInput(), NOW);

      expect(pkg.selectedCv).toBeNull();
      expect(pkg.rejectedCvs).toEqual([]);
      expect(pkg.selectedCertificates).toEqual([]);
      expect(pkg.omittedCertificates).toEqual([]);
      expect(pkg.attachments).toEqual([]);
    });

    it('does not mutate the input candidate arrays while sorting', () => {
      const cvA = buildDocument('cv-a', { uploadedAt: new Date('2025-01-01T00:00:00.000Z') });
      const cvB = buildDocument('cv-b', { uploadedAt: new Date('2026-01-01T00:00:00.000Z') });
      const original = [cvA, cvB];
      const input = buildInput({ documents: { cvCandidates: original, motivationLetterCandidates: [], certificateCandidates: [] } });

      strategy.assemble(input, NOW);

      expect(original).toEqual([cvA, cvB]);
    });
  });
});
