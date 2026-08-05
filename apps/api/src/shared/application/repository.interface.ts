/** Generic repository port implemented by infrastructure-layer persistence adapters. */
export interface Repository<T, Id> {
  findById(id: Id): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: Id): Promise<void>;
}
