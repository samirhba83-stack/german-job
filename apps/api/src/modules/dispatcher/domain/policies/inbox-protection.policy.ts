import { Inject, Injectable } from '@nestjs/common';
import { DispatchOutcome } from '@german-job-engine/shared-types';
import { Campaign } from '../../../campaigns/domain/entities/campaign.entity';
import { ExecutionWindowPolicy } from '../../../campaigns/domain/policies/execution-window.policy';
import { allow, deny } from '../../../campaigns/domain/policies/campaign-policy.interface';
import { clamp01 } from '../../../../shared/domain';
import { InboxProtectionStrategy, RiskAssessment } from '../ports/inbox-protection-strategy.port';
import { DispatcherConfig, DISPATCHER_CONFIG } from '../dispatcher-config';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Default INBOX_PROTECTION_STRATEGY binding — Milestone 4's core philosophy in code: the system
 * optimizes for successful delivery, never for send volume. This is a *second*, risk-weighted
 * gate layered on top of the Scheduler's (M3) hard eligibility checks — a campaign can be
 * Scheduler-eligible (technically allowed) and still be refused here because its composite risk
 * profile makes sending unwise right now. When in doubt, this policy always prefers deny (delay)
 * over allow. All thresholds/weights come from injected DispatcherConfig — see that file for why.
 */
@Injectable()
export class InboxProtectionPolicy implements InboxProtectionStrategy {
  constructor(@Inject(DISPATCHER_CONFIG) private readonly config: DispatcherConfig) {}

  assess(campaign: Campaign, now: Date): RiskAssessment {
    const { highRiskThreshold, dailyUtilizationWeight, failureRateWeight } = this.config.inboxProtection;

    const dispatchedInLast24h = campaign.dispatchedInLast24Hours(now);
    const dailyUtilization = clamp01(dispatchedInLast24h / campaign.rateLimitProfile.maxPerDay);
    const failureRate = this.recentFailureRate(campaign, now);
    const riskScore = clamp01(dailyUtilizationWeight * dailyUtilization + failureRateWeight * failureRate);

    if (dailyUtilization >= 1) {
      return {
        riskScore,
        decision: deny('DAILY_LIMIT_EXCEEDED', `Daily dispatch limit of ${campaign.rateLimitProfile.maxPerDay} already reached.`),
      };
    }

    const windowDecision = new ExecutionWindowPolicy().authorize(campaign.executionWindow, now);
    if (!windowDecision.allowed) {
      return { riskScore, decision: deny('OUTSIDE_EXECUTION_WINDOW', windowDecision.explanation) };
    }

    if (riskScore >= highRiskThreshold) {
      return {
        riskScore,
        decision: deny(
          'EXECUTION_RISK_TOO_HIGH',
          `Composite risk score ${riskScore.toFixed(2)} meets or exceeds the ${highRiskThreshold} safety threshold ` +
            `(daily quota usage ${(dailyUtilization * 100).toFixed(0)}%, recent failure rate ${(failureRate * 100).toFixed(0)}%); ` +
            'delaying is safer than risking spam placement.',
        ),
      };
    }

    return { riskScore, decision: allow() };
  }

  private recentFailureRate(campaign: Campaign, now: Date): number {
    const windowStart = new Date(now.getTime() - DAY_MS);
    let attempts = 0;
    let failures = 0;

    for (const target of campaign.targets) {
      for (const attempt of target.dispatchAttempts) {
        if (attempt.attemptedAt < windowStart || attempt.attemptedAt > now) {
          continue;
        }
        attempts += 1;
        if (attempt.outcome === DispatchOutcome.FAILED) {
          failures += 1;
        }
      }
    }

    return attempts === 0 ? 0 : failures / attempts;
  }
}
