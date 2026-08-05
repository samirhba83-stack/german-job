import { ApplicationLifecycleStatus } from '@german-job-engine/shared-types';
import { TimelineEntry } from './timeline-entry.entity';

/**
 * The append-only, ordered ledger of every transition an Application has undergone.
 * `append()` returns a new Timeline rather than mutating in place — entries are never edited
 * or removed once written. "Nothing is ever lost" is enforced by the type, not by convention.
 */
export class Timeline {
  private constructor(private readonly _entries: ReadonlyArray<TimelineEntry>) {}

  static empty(): Timeline {
    return new Timeline([]);
  }

  static fromEntries(entries: ReadonlyArray<TimelineEntry>): Timeline {
    return new Timeline([...entries]);
  }

  append(entry: TimelineEntry): Timeline {
    return new Timeline([...this._entries, entry]);
  }

  entries(): ReadonlyArray<TimelineEntry> {
    return this._entries;
  }

  latest(): TimelineEntry | null {
    return this._entries.length > 0 ? this._entries[this._entries.length - 1] : null;
  }

  entriesForState(state: ApplicationLifecycleStatus): ReadonlyArray<TimelineEntry> {
    return this._entries.filter((entry) => entry.currentState === state);
  }

  /** Milliseconds spent in `state`, measured from when it was entered to when it was left
   * (or to `until` if it is still the current state). Null if the state was never entered. */
  durationInState(state: ApplicationLifecycleStatus, until: Date = new Date()): number | null {
    const enteredIndex = this._entries.findIndex((entry) => entry.currentState === state);
    if (enteredIndex === -1) {
      return null;
    }

    const enteredAt = this._entries[enteredIndex].timestamp;
    const nextEntry = this._entries[enteredIndex + 1];
    const leftAt = nextEntry ? nextEntry.timestamp : until;

    return leftAt.getTime() - enteredAt.getTime();
  }
}
