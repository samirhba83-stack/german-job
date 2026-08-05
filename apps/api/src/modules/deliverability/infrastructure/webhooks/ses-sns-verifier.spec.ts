import { generateKeyPairSync, createSign } from 'node:crypto';
import { SesSnsVerifier, SesSnsVerificationError } from './ses-sns-verifier';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CERT_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function stringToSignNotification(envelope: Record<string, string>): string {
  const pairs: [string, string][] = [
    ['Message', envelope.Message],
    ['MessageId', envelope.MessageId],
    ['Timestamp', envelope.Timestamp],
    ['TopicArn', envelope.TopicArn],
    ['Type', envelope.Type],
  ];
  return pairs.map(([k, v]) => `${k}\n${v}\n`).join('');
}

function stringToSignSubscription(envelope: Record<string, string>): string {
  const pairs: [string, string][] = [
    ['Message', envelope.Message],
    ['MessageId', envelope.MessageId],
    ['SubscribeURL', envelope.SubscribeURL],
    ['Timestamp', envelope.Timestamp],
    ['Token', envelope.Token],
    ['TopicArn', envelope.TopicArn],
    ['Type', envelope.Type],
  ];
  return pairs.map(([k, v]) => `${k}\n${v}\n`).join('');
}

function sign(stringToSign: string, key = privateKey): string {
  const signer = createSign('RSA-SHA1');
  signer.update(stringToSign, 'utf8');
  return signer.sign(key, 'base64');
}

function buildNotificationEnvelope(sesMessage: Record<string, unknown>): Record<string, string> {
  const base: Record<string, string> = {
    Type: 'Notification',
    MessageId: 'sns-msg-1',
    TopicArn: 'arn:aws:sns:eu-central-1:123456789012:ses-events',
    Message: JSON.stringify(sesMessage),
    Timestamp: new Date().toISOString(),
    SignatureVersion: '1',
    SigningCertURL: 'https://sns.eu-central-1.amazonaws.com/SimpleNotificationService-abc.pem',
  };
  const signature = sign(stringToSignNotification(base));
  return { ...base, Signature: signature };
}

describe('SesSnsVerifier (real RSA scheme + SSRF host guard)', () => {
  const verifier = new SesSnsVerifier();

  it('parses and verifies a genuine hard-bounce notification', () => {
    const envelope = buildNotificationEnvelope({
      notificationType: 'Bounce',
      mail: { messageId: 'ses-msg-1' },
      bounce: { bounceType: 'Permanent', bounceSubType: 'General' },
    });
    const rawBody = Buffer.from(JSON.stringify(envelope));

    verifier.assertRealSnsHost(envelope.SigningCertURL);
    expect(() => verifier.verifySignature(rawBody, CERT_PEM)).not.toThrow();

    const result = verifier.parse(rawBody);
    expect(result).toMatchObject({ kind: 'EVENT', event: { providerMessageId: 'ses-msg-1', eventType: 'BOUNCE_HARD' } });
  });

  it('parses a complaint notification', () => {
    const envelope = buildNotificationEnvelope({
      notificationType: 'Complaint',
      mail: { messageId: 'ses-msg-2' },
      complaint: { complaintFeedbackType: 'abuse' },
    });
    const rawBody = Buffer.from(JSON.stringify(envelope));
    expect(() => verifier.verifySignature(rawBody, CERT_PEM)).not.toThrow();
    const result = verifier.parse(rawBody);
    expect(result).toMatchObject({ kind: 'EVENT', event: { eventType: 'COMPLAINT' } });
  });

  it('parses a delivery notification', () => {
    const envelope = buildNotificationEnvelope({ notificationType: 'Delivery', mail: { messageId: 'ses-msg-3' } });
    const rawBody = Buffer.from(JSON.stringify(envelope));
    const result = verifier.parse(rawBody);
    expect(result).toMatchObject({ kind: 'EVENT', event: { eventType: 'DELIVERED' } });
  });

  it('identifies a SubscriptionConfirmation without fetching it, and verifies its signature', () => {
    const base: Record<string, string> = {
      Type: 'SubscriptionConfirmation',
      MessageId: 'sns-sub-1',
      TopicArn: 'arn:aws:sns:eu-central-1:123456789012:ses-events',
      Message: 'You have chosen to subscribe to the topic...',
      SubscribeURL: 'https://sns.eu-central-1.amazonaws.com/?Action=ConfirmSubscription&Token=abc',
      Token: 'abc',
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1',
      SigningCertURL: 'https://sns.eu-central-1.amazonaws.com/SimpleNotificationService-abc.pem',
    };
    const envelope = { ...base, Signature: sign(stringToSignSubscription(base)) };
    const rawBody = Buffer.from(JSON.stringify(envelope));

    expect(() => verifier.verifySignature(rawBody, CERT_PEM)).not.toThrow();
    const result = verifier.parse(rawBody);
    expect(result).toEqual({ kind: 'SUBSCRIPTION_CONFIRMATION', subscribeUrl: base.SubscribeURL });
  });

  it('rejects a tampered body (signature no longer matches)', () => {
    const envelope = buildNotificationEnvelope({ notificationType: 'Delivery', mail: { messageId: 'ses-msg-4' } });
    const tamperedMessage = JSON.parse(envelope.Message);
    tamperedMessage.mail.messageId = 'attacker-injected-id';
    const tamperedEnvelope = { ...envelope, Message: JSON.stringify(tamperedMessage) };
    const rawBody = Buffer.from(JSON.stringify(tamperedEnvelope));

    expect(() => verifier.verifySignature(rawBody, CERT_PEM)).toThrow(SesSnsVerificationError);
  });

  it('rejects a signature produced by a different key pair (forged)', () => {
    const { privateKey: attackerKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const base: Record<string, string> = {
      Type: 'Notification',
      MessageId: 'sns-msg-forged',
      TopicArn: 'arn:aws:sns:eu-central-1:123456789012:ses-events',
      Message: JSON.stringify({ notificationType: 'Delivery', mail: { messageId: 'ses-msg-5' } }),
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1',
      SigningCertURL: 'https://sns.eu-central-1.amazonaws.com/SimpleNotificationService-abc.pem',
    };
    const envelope = { ...base, Signature: sign(stringToSignNotification(base), attackerKey) };
    const rawBody = Buffer.from(JSON.stringify(envelope));

    expect(() => verifier.verifySignature(rawBody, CERT_PEM)).toThrow(SesSnsVerificationError);
  });

  it('rejects a SigningCertURL host that is not a real Amazon SNS host (SSRF protection)', () => {
    const envelope = buildNotificationEnvelope({ notificationType: 'Delivery', mail: { messageId: 'ses-msg-6' } });
    const malicious = { ...envelope, SigningCertURL: 'https://attacker.example.com/fake-cert.pem' };
    const rawBody = Buffer.from(JSON.stringify(malicious));

    expect(() => verifier.parse(rawBody)).toThrow(SesSnsVerificationError);
    expect(() => verifier.assertRealSnsHost('https://attacker.example.com/fake-cert.pem')).toThrow(SesSnsVerificationError);
  });

  it('rejects a non-https SigningCertURL even on a real-looking host', () => {
    expect(() => verifier.assertRealSnsHost('http://sns.eu-central-1.amazonaws.com/cert.pem')).toThrow(SesSnsVerificationError);
  });

  it('rejects an envelope missing required fields', () => {
    const rawBody = Buffer.from(JSON.stringify({ Type: 'Notification' }));
    expect(() => verifier.parse(rawBody)).toThrow(SesSnsVerificationError);
  });

  it('rejects malformed JSON bodies', () => {
    expect(() => verifier.parse(Buffer.from('not json'))).toThrow(SesSnsVerificationError);
  });
});
