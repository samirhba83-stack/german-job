import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { CampaignActorRole } from '@german-job-engine/shared-types';
import { Campaign } from '../domain/entities/campaign.entity';
import { CampaignRepository } from '../domain/repositories/campaign.repository.interface';
import { CampaignId } from '../domain/value-objects/campaign-id.vo';
import { Actor } from '../domain/value-objects/actor.vo';
import { CorrelationId } from '../domain/value-objects/correlation-id.vo';
import { CampaignNotFoundException } from '../domain/exceptions/campaign-not-found.exception';
import { UnauthorizedCampaignActionException } from '../domain/exceptions/unauthorized-campaign-action.exception';
import { InvalidCampaignStatusTransitionException } from '../domain/exceptions/invalid-campaign-status-transition.exception';
import { MissingCampaignReasonException } from '../domain/exceptions/missing-campaign-reason.exception';
import { MissingCampaignTargetException } from '../domain/exceptions/missing-campaign-target.exception';
import { MissingCheckpointException } from '../domain/exceptions/missing-checkpoint.exception';
import { CampaignNotEditableException } from '../domain/exceptions/campaign-not-editable.exception';
import { DuplicateCampaignTargetException } from '../domain/exceptions/duplicate-campaign-target.exception';
import { CompanyInCooldownException } from '../domain/exceptions/company-in-cooldown.exception';
import { CampaignTargetNotFoundException } from '../domain/exceptions/campaign-target-not-found.exception';
import { CampaignBatchNotFoundException } from '../domain/exceptions/campaign-batch-not-found.exception';
import { RateLimitExceededException } from '../domain/exceptions/rate-limit-exceeded.exception';
import { ExecutionWindowClosedException } from '../domain/exceptions/execution-window-closed.exception';
import { ConcurrentModificationException } from '../domain/exceptions/concurrent-modification.exception';

/** Builds the Actor value object from the plain (role, id) pair every command carries. */
export function buildActor(role: CampaignActorRole, actorId: string | null): Actor {
  switch (role) {
    case CampaignActorRole.CANDIDATE:
      return Actor.candidate(actorId ?? '');
    case CampaignActorRole.ADMIN:
      return Actor.admin(actorId ?? '');
    case CampaignActorRole.SYSTEM:
      return Actor.system(actorId ?? 'system');
    case CampaignActorRole.AUTOMATION:
      return Actor.automation(actorId ?? 'automation');
    default:
      return Actor.system('unknown');
  }
}

/** Resolves the caller-supplied correlation id, or mints one — every transition needs one. */
export function resolveCorrelationId(value?: string): CorrelationId {
  return CorrelationId.create(value ?? randomUUID());
}

/** Validates the id shape, then fetches the Campaign or throws NotFoundException. */
export async function loadCampaignOrThrow(repository: CampaignRepository, campaignId: string): Promise<Campaign> {
  try {
    CampaignId.create(campaignId);
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : 'Invalid campaign id');
  }

  const campaign = await repository.findById(campaignId);
  if (!campaign) {
    throw new NotFoundException(new CampaignNotFoundException(campaignId).message);
  }
  return campaign;
}

/** Persists the aggregate and publishes any domain events it raised, then clears them. */
export async function saveAndPublish(repository: CampaignRepository, eventBus: EventBus, campaign: Campaign): Promise<void> {
  await repository.save(campaign);
  campaign.domainEvents.forEach((event) => eventBus.publish(event));
  campaign.clearDomainEvents();
}

/**
 * Application-layer ownership check — for the Campaign Execution Engine, permission/ownership
 * enforcement is explicitly an Application Layer concern (not a Domain Policy), per the
 * approved Phase 2 scope. Only the owning candidate, or an admin, may issue a write command.
 */
export function assertOwnerOrAdmin(campaign: Campaign, actorRole: CampaignActorRole, actorId: string | null): void {
  if (actorRole === CampaignActorRole.ADMIN) {
    return;
  }
  if (actorRole === CampaignActorRole.CANDIDATE && campaign.isOwnedBy(actorId)) {
    return;
  }
  throw new ForbiddenException('Only the owning candidate or an admin may perform this action.');
}

/** Translates domain-layer failures into the appropriate HTTP-shaped exception. */
export function mapDomainError(error: unknown): never {
  if (error instanceof UnauthorizedCampaignActionException) {
    throw new ForbiddenException(error.message);
  }
  if (error instanceof InvalidCampaignStatusTransitionException) {
    throw new ConflictException(error.message);
  }
  if (
    error instanceof MissingCampaignReasonException ||
    error instanceof MissingCampaignTargetException ||
    error instanceof MissingCheckpointException ||
    error instanceof CampaignNotEditableException
  ) {
    throw new BadRequestException(error.message);
  }
  if (
    error instanceof DuplicateCampaignTargetException ||
    error instanceof CompanyInCooldownException ||
    error instanceof RateLimitExceededException ||
    error instanceof ExecutionWindowClosedException ||
    error instanceof ConcurrentModificationException
  ) {
    throw new ConflictException(error.message);
  }
  if (error instanceof CampaignTargetNotFoundException || error instanceof CampaignBatchNotFoundException) {
    throw new NotFoundException(error.message);
  }
  throw error;
}
