import { Inject, Injectable } from '@nestjs/common';
import { CampaignStatus } from '@german-job-engine/shared-types';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import {
  CAMPAIGN_REPOSITORY,
  CampaignRepository,
} from '../../../campaigns/domain/repositories/campaign.repository.interface';
import { CampaignSearchSpecification } from '../../../campaigns/domain/specifications/campaign-search.specification';
import { ExecutionClock, EXECUTION_CLOCK } from '../../../execution/domain/ports/execution-clock.port';
import { NextExecutionTimeCalculator } from '../../../campaigns/domain/services/next-execution-time.calculator';
import { EligibilityEvaluation, EligibilityStrategy, ELIGIBILITY_STRATEGY } from '../../domain/ports/eligibility-strategy.port';
import { PriorityStrategy, PRIORITY_STRATEGY } from '../../domain/ports/priority-strategy.port';
import { SchedulingDecision } from '../../domain/scheduling-decision';
import { CampaignSchedulerPort } from '../../domain/ports/campaign-scheduler.port';

const SEARCH_PAGE_LIMIT = 100;

/** reasonCodes for which nextExecutionAt is computable from window/cooldown alone. */
const RECOVERABLE_REASON_CODES = new Set(['COOLDOWN_ACTIVE', 'OUTSIDE_EXECUTION_WINDOW']);

/**
 * Decides WHICH campaigns are eligible for execution and in WHAT ORDER — nothing more. Never
 * dispatches, never touches the ExecutionQueue/DistributedLock ports from M2, never sends
 * anything. A future Dispatcher (later milestone) is the intended, still-unbuilt consumer of
 * this service's output.
 */
@Injectable()
export class CampaignSchedulerService implements CampaignSchedulerPort {
  /**
   * NextExecutionTimeCalculator is instantiated directly — it is deterministic ExecutionWindow
   * math with exactly one correct answer, not a replaceable business policy (see its own doc
   * comment). Eligibility and priority scoring, by contrast, are injected via DI ports: both are
   * genuine "AI capability" replacement points a future milestone may swap out, and neither may
   * be hardcoded inside this service per the Phase 4 architecture review.
   */
  private readonly nextExecutionTimeCalculator = new NextExecutionTimeCalculator();

  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaignRepository: CampaignRepository,
    @Inject(EXECUTION_CLOCK) private readonly clock: ExecutionClock,
    @Inject(ELIGIBILITY_STRATEGY) private readonly eligibilityStrategy: EligibilityStrategy,
    @Inject(PRIORITY_STRATEGY) private readonly priorityStrategy: PriorityStrategy,
  ) {}

  /** Evaluates every RUNNING campaign, eligible or not, for observability. */
  async evaluateAll(): Promise<SchedulingDecision[]> {
    const pairs = await this.evaluateAllWithEntities();
    return pairs.map((pair) => pair.decision);
  }

  /** The Scheduler's core deliverable: only the campaigns eligible to run right now, ranked. */
  async getEligibleCampaigns(): Promise<SchedulingDecision[]> {
    const pairs = await this.getEligibleCampaignsWithEntities();
    return pairs.map((pair) => pair.decision);
  }

  /**
   * Same as getEligibleCampaigns(), but keeps the source Campaign alongside each decision.
   * The Scheduler's own decision fields aren't enough for a consumer that needs to reason about
   * the campaign itself (e.g. Phase 4 M4's Dispatcher, which computes risk/confidence/adaptive
   * batch sizing from targets, health, and rate-limit history) — added here rather than having
   * that consumer re-fetch and re-evaluate independently, which would duplicate this exact
   * pagination-and-evaluation logic.
   */
  async getEligibleCampaignsWithEntities(): Promise<Array<{ decision: SchedulingDecision; campaign: Campaign }>> {
    const pairs = await this.evaluateAllWithEntities();
    return pairs.filter((pair) => pair.decision.eligible);
  }

  private async evaluateAllWithEntities(): Promise<Array<{ decision: SchedulingDecision; campaign: Campaign }>> {
    const now = this.clock.now();
    const campaigns = await this.fetchRunningCampaigns();
    const pairs = campaigns.map((campaign) => ({ campaign, decision: this.evaluateCampaign(campaign, now) }));
    return this.sortByPriority(pairs);
  }

  private evaluateCampaign(campaign: Campaign, now: Date): SchedulingDecision {
    const evaluation = this.eligibilityStrategy.evaluate(campaign, now);
    const priority = evaluation.decision.allowed ? this.priorityStrategy.evaluate(campaign, now) : 0;

    return {
      campaignId: campaign.id,
      eligible: evaluation.decision.allowed,
      reasonCode: evaluation.decision.reasonCode,
      explanation: evaluation.decision.explanation,
      priority,
      plannedBatchSize: evaluation.plannedBatchSize,
      nextExecutionAt: this.resolveNextExecutionAt(campaign, now, evaluation),
    };
  }

  private resolveNextExecutionAt(campaign: Campaign, now: Date, evaluation: EligibilityEvaluation): Date | null {
    if (evaluation.decision.allowed) {
      return now;
    }
    if (!RECOVERABLE_REASON_CODES.has(evaluation.decision.reasonCode)) {
      return null;
    }

    const cooldownUntil = campaign.cooldown?.until ?? null;
    return this.nextExecutionTimeCalculator.calculate(campaign.executionWindow, cooldownUntil, now);
  }

  private sortByPriority<T extends { decision: SchedulingDecision }>(pairs: T[]): T[] {
    return [...pairs].sort((a, b) => this.compareDecisions(a.decision, b.decision));
  }

  private compareDecisions(a: SchedulingDecision, b: SchedulingDecision): number {
    if (a.eligible !== b.eligible) {
      return a.eligible ? -1 : 1;
    }
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    const aNext = a.nextExecutionAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bNext = b.nextExecutionAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aNext !== bNext) {
      return aNext - bNext;
    }
    return a.campaignId.localeCompare(b.campaignId);
  }

  private async fetchRunningCampaigns(): Promise<Campaign[]> {
    const campaigns: Campaign[] = [];
    let page = 1;

    for (;;) {
      const specification = CampaignSearchSpecification.create({
        status: CampaignStatus.RUNNING,
        page,
        limit: SEARCH_PAGE_LIMIT,
      });
      const result = await this.campaignRepository.search(specification);
      campaigns.push(...result.items);

      if (result.items.length === 0 || campaigns.length >= result.total) {
        break;
      }
      page += 1;
    }

    return campaigns;
  }
}
