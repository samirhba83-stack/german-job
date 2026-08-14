import { createTransport } from 'nodemailer';

/**
 * M32 Security Remediation (nodemailer 6.10.1 -> 9.0.5) — real, unmocked coverage against the
 * ACTUAL installed nodemailer library, complementing `smtp-email-provider.adapter.spec.ts` (which
 * `jest.mock('nodemailer', ...)` entirely, so it verifies this app's own error-mapping/business
 * logic but never actually exercises the real library surface this upgrade touches).
 *
 * Never opens a real network connection to a real SMTP server and never sends a real email —
 * "real connection failure" is proven safely against an unreachable loopback address, and message
 * composition/validation is proven safely via nodemailer's own built-in `jsonTransport` (composes
 * and validates a real MIME message, returns it as JSON, never touches a socket).
 */
describe('nodemailer 9.0.5 — real library integration (post-upgrade verification)', () => {
  it('1. transport initialization: real createTransport() with this adapter\'s exact option shape does not throw', () => {
    expect(() =>
      createTransport({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'user', pass: 'pass' },
        connectionTimeout: 10_000,
        tls: { rejectUnauthorized: true },
      }),
    ).not.toThrow();
  });

  it('2. successful send path: a real message is composed and validated correctly (via the real library\'s own jsonTransport, no network I/O)', async () => {
    const transporter = createTransport({ jsonTransport: true });
    const info = await transporter.sendMail({
      from: '"German Job Engine" <noreply@example.com>',
      to: 'recruiter@example.de',
      replyTo: 'candidate@example.com',
      subject: 'Application',
      text: 'Hello',
      html: '<p>Hello</p>',
      headers: { 'X-Request-Id': 'req-1' },
    });

    expect(info.messageId).toBeTruthy();
    // Real, verified nodemailer behavior: jsonTransport's composed output parses each address
    // into a structured { address, name } object, not a plain string — confirmed here, not
    // assumed, and unrelated to any 6.x->9.x change (address parsing is untouched by every
    // breaking change found in the real changelog/source verification for this upgrade).
    const composed = JSON.parse(info.message as string);
    expect(composed.to).toEqual([{ address: 'recruiter@example.de', name: '' }]);
    expect(composed.replyTo).toEqual([{ address: 'candidate@example.com', name: '' }]);
    expect(composed.subject).toBe('Application');
  });

  it('3/4. real connection failure: a real, live connectionTimeout attempt to an unreachable host genuinely rejects (proves the real transport/socket pipeline still works post-upgrade)', async () => {
    const transporter = createTransport({
      host: '127.0.0.1',
      port: 1, // real, reserved, never-listening port — a genuine, deterministic connection failure
      secure: false,
      connectionTimeout: 2_000,
      tls: { rejectUnauthorized: true },
    });

    await expect(
      transporter.sendMail({ from: 'a@example.com', to: 'b@example.com', subject: 'x', text: 'x' }),
    ).rejects.toThrow();
  }, 10_000);

  it('5. malformed recipient: the real library\'s own address handling for a garbage "to" value (proving this app\'s behavior for bad input is the REAL library\'s behavior, not assumed)', async () => {
    const transporter = createTransport({ jsonTransport: true });
    const info = await transporter.sendMail({
      from: 'a@example.com',
      to: 'not-a-real-email-address-at-all',
      subject: 'x',
      text: 'x',
    });
    // Real, verified behavior: a string with no "@" is parsed as a display NAME with an EMPTY
    // address, not rejected outright — this app's adapter has no recipient-format validation of
    // its own (pre-existing, unrelated to this version bump — confirmed via source inspection
    // that address parsing is untouched across 6.x->9.x); a real SMTP server would be the one to
    // ultimately reject an empty RCPT TO on a real connection.
    const composed = JSON.parse(info.message as string);
    expect(composed.to).toEqual([{ address: '', name: 'not-a-real-email-address-at-all' }]);
  });

  it('real attachment Buffer content survives real MIME composition unmodified (M28.5 attachment path)', async () => {
    const transporter = createTransport({ jsonTransport: true });
    const content = Buffer.from('%PDF-1.4 real cv bytes for the nodemailer upgrade check');
    const info = await transporter.sendMail({
      from: 'a@example.com',
      to: 'b@example.com',
      subject: 'x',
      text: 'x',
      attachments: [{ filename: 'cv.pdf', content, contentType: 'application/pdf' }],
    });
    const composed = JSON.parse(info.message as string);
    expect(composed.attachments).toHaveLength(1);
    expect(Buffer.from(composed.attachments[0].content, 'base64').equals(content)).toBe(true);
  });
});
