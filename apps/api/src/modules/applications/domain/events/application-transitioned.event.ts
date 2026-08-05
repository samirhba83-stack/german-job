import { ApplicationLifecycleEvent } from './application-lifecycle.event';

/**
 * Raised on every single transition, in addition to the specific event for that transition —
 * the one stream a new Intelligence Engine can subscribe to on day one without knowing about
 * every specific event type in advance.
 */
export class ApplicationTransitioned extends ApplicationLifecycleEvent {}
