/**
 * The 10-state Campaign lifecycle. Not a strict linear chain — Paused/CoolingDown/Resuming
 * form a cycle back to Running, Completed/Stopped/Cancelled are independent exit lanes, and
 * Archived is the universal terminal sink reachable from every non-terminal state.
 */
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  READY = 'READY',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COOLING_DOWN = 'COOLING_DOWN',
  RESUMING = 'RESUMING',
  COMPLETED = 'COMPLETED',
  STOPPED = 'STOPPED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}
