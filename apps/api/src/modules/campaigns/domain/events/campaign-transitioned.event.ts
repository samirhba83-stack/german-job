import { CampaignLifecycleEvent } from './campaign-lifecycle.event';

/** Generic envelope raised alongside every specific transition event. */
export class CampaignTransitioned extends CampaignLifecycleEvent {}
