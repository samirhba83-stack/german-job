import { Application } from '../../domain/entities/application.entity';
import { TimelineEntry } from '../../domain/entities/timeline-entry.entity';
import { ApplicationReadModel, ApplicationHistoryEntryReadModel, TimelineEntryReadModel } from './application.read-model';

export class ApplicationReadModelMapper {
  static toReadModel(application: Application): ApplicationReadModel {
    return {
      id: application.id,
      candidateId: application.candidateId,
      jobId: application.jobId,
      companyId: application.companyId,
      status: application.status,
      snapshot: {
        jobTitle: application.snapshot.jobTitle,
        companyName: application.snapshot.companyName,
        jobLocation: application.snapshot.jobLocation,
        salaryRangeSummary: application.snapshot.salaryRangeSummary,
        capturedAt: application.snapshot.capturedAt,
      },
      channel: {
        type: application.channel.type,
        campaignRef: application.channel.campaignRef,
      },
      intelligence: application.intelligence
        ? {
            replyProbability: application.intelligence.replyProbability?.value ?? null,
            interviewProbability: application.intelligence.interviewProbability?.value ?? null,
            offerProbability: application.intelligence.offerProbability?.value ?? null,
            contractProbability: application.intelligence.contractProbability?.value ?? null,
            expectedTimeToReply: application.intelligence.expectedTimeToReply
              ? {
                  amount: application.intelligence.expectedTimeToReply.amount,
                  unit: application.intelligence.expectedTimeToReply.unit,
                }
              : null,
            expectedTimeToInterview: application.intelligence.expectedTimeToInterview
              ? {
                  amount: application.intelligence.expectedTimeToInterview.amount,
                  unit: application.intelligence.expectedTimeToInterview.unit,
                }
              : null,
            expectedTimeToContract: application.intelligence.expectedTimeToContract
              ? {
                  amount: application.intelligence.expectedTimeToContract.amount,
                  unit: application.intelligence.expectedTimeToContract.unit,
                }
              : null,
            confidenceScore: application.intelligence.confidenceScore?.value ?? null,
            historicalSuccessScore: application.intelligence.historicalSuccessScore?.value ?? null,
            riskScore: application.intelligence.riskScore?.value ?? null,
            decisionExplanation: application.intelligence.decisionExplanation,
            recommendationExplanation: application.intelligence.recommendationExplanation,
            computedAt: application.intelligence.computedAt,
            computedBy: application.intelligence.computedBy,
          }
        : null,
      submittedAt: application.submittedAt,
      lastActivityAt: application.lastActivityAt,
      isTerminal: application.isTerminal(),
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }

  static toTimelineEntryReadModel(entry: TimelineEntry): TimelineEntryReadModel {
    return {
      id: entry.id,
      timestamp: entry.timestamp,
      actor: { role: entry.actor.role, actorId: entry.actor.actorId },
      source: { type: entry.source.type, campaignRef: entry.source.campaignRef },
      reason: entry.reason ? { code: entry.reason.code, note: entry.reason.note } : null,
      previousState: entry.previousState,
      currentState: entry.currentState,
      metadata: { ...entry.metadata.entries },
      correlationId: entry.correlationId.value,
      evidenceReference: entry.evidenceReference
        ? {
            type: entry.evidenceReference.type,
            externalId: entry.evidenceReference.externalId,
            url: entry.evidenceReference.url,
          }
        : null,
      confidence: entry.confidence?.value ?? null,
    };
  }

  static toHistoryEntryReadModel(entry: TimelineEntry): ApplicationHistoryEntryReadModel {
    return {
      timestamp: entry.timestamp,
      summary: ApplicationReadModelMapper.summarize(entry),
      actor: { role: entry.actor.role, actorId: entry.actor.actorId },
    };
  }

  private static summarize(entry: TimelineEntry): string {
    const who = entry.actor.role.charAt(0) + entry.actor.role.slice(1).toLowerCase();
    const base = entry.previousState
      ? `${who} moved the application from ${entry.previousState} to ${entry.currentState}`
      : `${who} created the application in ${entry.currentState}`;

    if (entry.reason?.note) {
      return `${base} — ${entry.reason.note}`;
    }
    if (entry.reason) {
      return `${base} (${entry.reason.code})`;
    }
    return base;
  }
}
