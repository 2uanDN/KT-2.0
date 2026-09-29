import { db } from '../database';
import type { Collection } from '../../types/collection';

export class CollectionRepo {
  async getById(id: string): Promise<Collection | undefined> {
    return db.collections.get(id);
  }

  async getByName(name: string): Promise<Collection | undefined> {
    const rawTrimmed = name.trim();
    if (!rawTrimmed) return undefined;

    // Single query: Dexie's case-insensitive index lookup matches existing collections regardless of casing
    return db.collections.where('name').equalsIgnoreCase(rawTrimmed).first();
  }

  async getAll(): Promise<Collection[]> {
    return db.collections.orderBy('createdAt').reverse().toArray();
  }

  async add(collection: Collection): Promise<string> {
    return db.collections.add(collection);
  }

  async update(id: string, patch: Partial<Collection>): Promise<number> {
    return db.collections.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    return db.collections.delete(id);
  }
}

export const collectionRepo = new CollectionRepo();

