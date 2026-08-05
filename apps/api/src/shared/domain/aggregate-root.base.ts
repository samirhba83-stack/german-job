import { Entity } from './entity.base';
import { DomainEvent } from './domain-event.base';

/** Base class for aggregate roots — entities that own domain events raised within their boundary. */
export abstract class AggregateRoot<Id> extends Entity<Id> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
