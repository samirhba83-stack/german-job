import { CreateSenderIdentityInput, SenderIdentityRecord, SenderVerificationStatus } from '../models/sender-identity';

export const SENDER_IDENTITY_REPOSITORY = Symbol('SENDER_IDENTITY_REPOSITORY');

export interface SenderIdentityRepository {
  findById(id: string): Promise<SenderIdentityRecord | null>;
  findByEmailAndProvider(emailAddress: string, providerId: string): Promise<SenderIdentityRecord | null>;
  listAll(): Promise<SenderIdentityRecord[]>;
  create(input: CreateSenderIdentityInput, now: Date): Promise<SenderIdentityRecord>;
  updateVerification(
    id: string,
    fields: { verificationStatus: SenderVerificationStatus; dkimVerified?: boolean; spfReady?: boolean; dmarcReady?: boolean; failureReason: string | null; providerIdentityRef?: string | null },
    now: Date,
  ): Promise<SenderIdentityRecord>;
  setActive(id: string, isActive: boolean): Promise<void>;
}
