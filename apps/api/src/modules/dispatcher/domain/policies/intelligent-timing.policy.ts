import { Inject, Injectable } from '@nestjs/common';
import { ExecutionWindow } from '../../../campaigns/domain/value-objects/execution-window.vo';
import { IsWithinExecutionWindowSpecification } from '../../../campaigns/domain/specifications/is-within-execution-window.specification';
import { NextExecutionTimeCalculator } from '../../../campaigns/domain/services/next-execution-time.calculator';
import { IntelligentTimingStrategy, TimingRecommendation } from '../ports/intelligent-timing-strategy.port';
import { DispatcherConfig, DISPATCHER_CONFIG } from '../dispatcher-config';

/**
 * Default INTELLIGENT_TIMING_STRATEGY binding. Advisory-only: suggests the best moment to
 * execute from an HR-engagement perspective, distinct from ExecutionWindow's hard weekday/hour
 * gate. A campaign whose window already permits sending at 23:00 will still get a suggestion to
 * wait for the next business morning here — the caller decides whether to follow it (Milestone
 * 4: "The recommendation must be optional. The user may override it."). Reuses
 * IsWithinExecutionWindowSpecification and NextExecutionTimeCalculator (Phase 4 M1/campaigns
 * domain) against a synthetic business-hours window instead of re-deriving zoned weekday/hour
 * resolution a third time. Business-hours bounds come from injected DispatcherConfig.
 */
@Injectable()
export class IntelligentTimingPolicy implements IntelligentTimingStrategy {
  private readonly nextExecutionTimeCalculator = new NextExecutionTimeCalculator();

  constructor(@Inject(DISPATCHER_CONFIG) private readonly config: DispatcherConfig) {}

  recommend(from: Date, timezone: string): TimingRecommendation {
    const businessWindow = this.businessHoursWindow(timezone);

    if (IsWithinExecutionWindowSpecification.isSatisfiedBy(businessWindow, from)) {
      return {
        recommendedAt: from,
        reasonCode: 'WITHIN_BUSINESS_HOURS',
        explanation: 'Current time falls within typical HR business hours; no delay recommended.',
      };
    }

    const recommendedAt = this.nextExecutionTimeCalculator.calculate(businessWindow, null, from) ?? from;
    const { businessStartHour, businessEndHour } = this.config.intelligentTiming;

    return {
      recommendedAt,
      reasonCode: 'OUTSIDE_BUSINESS_HOURS',
      explanation:
        `Current time falls outside typical HR business hours (${businessStartHour}:00-${businessEndHour}:00, ${timezone}). ` +
        `HR departments are more likely to review applications during business hours, so waiting until ${recommendedAt.toISOString()} ` +
        'is recommended. This is advisory only and may be overridden.',
    };
  }

  private businessHoursWindow(timezone: string): ExecutionWindow {
    const { businessStartHour, businessEndHour, businessWeekdays } = this.config.intelligentTiming;
    return ExecutionWindow.create({
      allowedWeekdays: [...businessWeekdays],
      dailyStartHour: businessStartHour,
      dailyEndHour: businessEndHour,
      timezone,
      respectHolidays: true,
    });
  }
}
