import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APPLICATION_REPOSITORY, ApplicationRepository } from '../../domain/repositories/application.repository.interface';
import {
  APPLICATION_OPERATIONAL_DECISION_REPOSITORY,
  ApplicationOperationalDecisionRepository,
} from '../../domain/repositories/application-operational-decision.repository.interface';
import { ApplicationOperationalDecisionRecord, ApplicationOperationalDecisionType } from '../../domain/models/application-operational-decision';

export interface RecordOperationalDecisionParams {
  readonly applicationId: string;
  readonly decisionType: ApplicationOperationalDecisionType;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly reason: string | null;
  readonly evidence: Readonly<Record<string, unknown>> | null;
  readonly correlationId: string | null;
  readonly idempotencyKey: string;
}

/**
 * M30 Phase 6 — the one shared write path all 6 additive operational-decision commands
 * (`RecordDocumentRequestCommand`, `RecordInformationRequestCommand`,
 * `RecordAssessmentInvitationCommand`, `MarkApplicationUnderReviewCommand`,
 * `MarkApplicationWaitingCommand`, `RecordExternalOfferEvidenceCommand`) delegate to. Deliberately
 * NEVER touches `Application.status` or any aggregate transition method — confirms the
 * application exists (real existence check, same `NotFoundException` shape every other command
 * uses via `loadApplicationOrThrow`) then persists a real, additive
 * `ApplicationOperationalDecision` row. This is a real, authoritative application-layer service —
 * never a raw repository write from inbox-intelligence code (Non-Negotiable Principle #15).
 */
@Injectable()
export class OperationalDecisionCommandHelper {
  constructor(
    @Inject(APPLICATION_REPOSITORY) private readonly applications: ApplicationRepository,
    @Inject(APPLICATION_OPERATIONAL_DECISION_REPOSITORY) private readonly decisions: ApplicationOperationalDecisionRepository,
  ) {}

  async record(params: RecordOperationalDecisionParams): Promise<ApplicationOperationalDecisionRecord> {
    const application = await this.applications.findById(params.applicationId);
    if (!application) {
      throw new NotFoundException(`Application ${params.applicationId} not found.`);
    }

    const result = await this.decisions.recordIfNotDuplicate(
      {
        applicationId: params.applicationId,
        decisionType: params.decisionType,
        actorType: params.actorType,
        actorId: params.actorId,
        reason: params.reason,
        evidence: params.evidence,
        correlationId: params.correlationId,
        idempotencyKey: params.idempotencyKey,
      },
      new Date(),
    );
    return result.decision;
  }
}
