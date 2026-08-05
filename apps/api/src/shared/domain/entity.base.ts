/** Base class for domain entities identified by a stable id (not value equality). */
export abstract class Entity<Id> {
  protected readonly _id: Id;

  protected constructor(id: Id) {
    this._id = id;
  }

  get id(): Id {
    return this._id;
  }

  equals(other?: Entity<Id>): boolean {
    if (!other) return false;
    if (this === other) return true;
    return this._id === other._id;
  }
}
