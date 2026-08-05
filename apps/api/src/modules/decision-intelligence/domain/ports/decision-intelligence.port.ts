import { DecisionReport } from '../decision-report';

export const DECISION_INTELLIGENCE_PORT = Symbol('DECISION_INTELLIGENCE_PORT');

/** The stable port downstream Phase 4 modules (Execution Planning) depend on, rather than the
 * concrete DecisionIntelligenceService — mirrors ExecutionEventRecorder's port/token pattern. */
export interface DecisionIntelligencePort {
  generateDecisionReports(): Promise<DecisionReport[]>;
}
