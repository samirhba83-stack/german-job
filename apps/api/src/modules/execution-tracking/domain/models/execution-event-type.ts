/**
 * The full event vocabulary. REPLY_RECEIVED and INTERVIEW_SCHEDULED are
 * defined now for forward compatibility with Mission Control (M17's own
 * examples list them) but have no producer in this milestone — no reply
 * tracking or interview scheduling capability exists anywhere in the
 * domain yet. Recording either type honestly waits for the milestone that
 * introduces that capability.
 */
export type ExecutionEventType =
  | 'CAMPAIGN_EXECUTION_STARTED'
  | 'RECOMMENDATION_GENERATED'
  | 'DECISION_MADE'
  | 'EXECUTION_PLANNED'
  | 'PIPELINE_ORCHESTRATED'
  | 'TASK_SELECTED'
  | 'TASK_EXECUTED'
  | 'POLICY_EVALUATED'
  | 'APPLICATION_PACKAGE_ASSEMBLED'
  | 'PROVIDER_SELECTED'
  | 'EMAIL_DELIVERY_ATTEMPTED'
  | 'EMAIL_DELIVERY_CONFIRMED'
  | 'EMAIL_DELIVERY_FAILED'
  | 'REPLY_RECEIVED'
  | 'INTERVIEW_SCHEDULED'
  // M26: activation-layer values — see execution-activation module.
  | 'CAMPAIGN_EXECUTION_REJECTED'
  | 'CAMPAIGN_EXECUTION_COMPLETED'
  | 'CHECKPOINT_SAVED'
  | 'TASK_RETRY_SCHEDULED'
  | 'TASK_TERMINATED'
  | 'DELIVERY_RESULT_UNKNOWN';

export type ExecutionEventStatus = 'SUCCESS' | 'FAILURE';
