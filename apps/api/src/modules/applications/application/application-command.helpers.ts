import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { ActorRole } from '@german-job-engine/shared-types';
import { Application } from '../domain/entities/application.entity';
import { ApplicationRepository } from '../domain/repositories/application.repository.interface';
import { ApplicationId } from '../domain/value-objects/application-id.vo';
import { Actor } from '../domain/value-objects/actor.vo';
import { CorrelationId } from '../domain/value-objects/correlation-id.vo';
import { UnauthorizedApplicationActionException } from '../domain/exceptions/unauthorized-application-action.exception';
import { InvalidApplicationStatusTransitionException } from '../domain/exceptions/invalid-application-status-transition.exception';
import { MissingTransitionReasonException } from '../domain/exceptions/missing-transition-reason.exception';
import { MissingTrackingEvidenceException } from '../domain/exceptions/missing-tracking-evidence.exception';
import { CompanyRepository } from '../../companies/domain/repositories/company.repository.interface';

/** Builds the Actor value object from the plain (role, id) pair every command carries. */
export function buildActor(role: ActorRole, actorId: string | null): Actor {
  switch (role) {
    case ActorRole.CANDIDATE:
      return Actor.candidate(actorId ?? '');
    case ActorRole.COMPANY:
      return Actor.company(actorId ?? '');
    case ActorRole.ADMIN:
      return Actor.admin(actorId ?? '');
    case ActorRole.SYSTEM:
      return Actor.system(actorId ?? 'system');
    case ActorRole.AUTOMATION:
      return Actor.automation(actorId ?? 'automation');
    default:
      return Actor.system('unknown');
  }
}

/** Resolves the caller-supplied correlation id, or mints one — every transition needs one. */
export function resolveCorrelationId(value?: string): CorrelationId {
  return CorrelationId.create(value ?? randomUUID());
}

/** Validates the id shape, then fetches the Application or throws NotFoundException. Shared by
 * every command and query handler that operates on a single Application. */
export async function loadApplicationOrThrow(
  repository: ApplicationRepository,
  applicationId: string,
): Promise<Application> {
  try {
    ApplicationId.create(applicationId);
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : 'Invalid application id');
  }

  const application = await repository.findById(applicationId);
  if (!application) {
    throw new NotFoundException(`Application not found: ${applicationId}`);
  }

  return application;
}

/** Persists the aggregate and publishes any domain events it raised, then clears them —
 * identical to the Job/Company/Profile handler convention. */
export async function saveAndPublish(
  repository: ApplicationRepository,
  eventBus: EventBus,
  application: Application,
): Promise<void> {
  await repository.save(application);
  application.domainEvents.forEach((event) => eventBus.publish(event));
  application.clearDomainEvents();
}

/**
 * Shared ownership guard for Application handlers acting on behalf of a Company — mirrors Jobs'
 * assertCanManageJob. Admin and System actors bypass; a Company actor must own the Application's
 * associated Company. Used by handlers whose domain policy allows any Company actor (the domain
 * layer cannot check cross-aggregate ownership itself without a repository call).
 */
export async function assertActorOwnsCompany(
  companyRepository: CompanyRepository,
  companyId: string,
  actorRole: ActorRole,
  actorId: string | null,
): Promise<void> {
  if (actorRole === ActorRole.ADMIN || actorRole === ActorRole.SYSTEM) return;

  if (actorRole === ActorRole.COMPANY && actorId) {
    const company = await companyRepository.findById(companyId);
    if (company && company.ownerId === actorId) return;
  }

  throw new ForbiddenException("You do not have permission to act on behalf of this application's company");
}

/**
 * Shared access guard for reading or archiving an Application: the owning Candidate, an Admin, a
 * System actor, or an Employer who owns the associated Company may all access it — nobody else.
 */
export async function assertCanAccessApplication(
  companyRepository: CompanyRepository,
  application: Application,
  actorRole: ActorRole,
  actorId: string | null,
): Promise<void> {
  if (actorRole === ActorRole.ADMIN || actorRole === ActorRole.SYSTEM) return;
  if (actorRole === ActorRole.CANDIDATE && actorId === application.candidateId) return;

  if (actorRole === ActorRole.COMPANY && actorId) {
    const company = await companyRepository.findById(application.companyId);
    if (company && company.ownerId === actorId) return;
  }

  throw new ForbiddenException('You do not have permission to access this application');
}

/**
 * Translates domain-layer transition failures into the appropriate HTTP-shaped exception.
 * The Domain Policies themselves (invoked inside the aggregate's transition methods) are the
 * actual authorization authority — this only maps their refusal to a response.
 */
export function mapTransitionError(error: unknown): never {
  if (error instanceof UnauthorizedApplicationActionException) {
    throw new ForbiddenException(error.message);
  }
  if (error instanceof InvalidApplicationStatusTransitionException) {
    throw new ConflictException(error.message);
  }
  if (error instanceof MissingTransitionReasonException || error instanceof MissingTrackingEvidenceException) {
    throw new BadRequestException(error.message);
  }
  throw error;
}
