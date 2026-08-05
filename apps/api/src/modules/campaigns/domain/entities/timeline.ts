import { CampaignStatus } from '@german-job-engine/shared-types';
import { CampaignTimelineEntry } from './campaign-timeline-entry.entity';

/**
 * The append-only, ordered ledger of every transition a Campaign has undergone. `append()`
 * returns a new Timeline rather than mutating in place — "nothing is ever lost" is enforced
 * by the type, exactly as in the Application Lifecycle Engine.
 */
export class Timeline {
  private constructor(private readonly _entries: ReadonlyArray<CampaignTimelineEntry>) {}

  static empty(): Timeline {
    return new Timeline([]);
  }

  static fromEntries(entries: ReadonlyArray<CampaignTimelineEntry>): Timeline {
    return new Timeline([...entries]);
  }

  append(entry: CampaignTimelineEntry): Timeline {
    return new Timeline([...this._entries, entry]);
  }

  entries(): ReadonlyArray<CampaignTimelineEntry> {
    return this._entries;
  }

  latest(): CampaignTimelineEntry | null {
    return this._entries.length > 0 ? this._entries[this._entries.length - 1] : null;
  }

  entriesForState(state: CampaignStatus): ReadonlyArray<CampaignTimelineEntry> {
    return this._entries.filter((entry) => entry.currentState === state);
  }
}
