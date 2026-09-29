import { collectionRepo } from '../db/repos/CollectionRepo';
import { db } from '../db/database';
import type { Collection } from '../types/collection';
import type { Item } from '../types/item';

export type CollectionDeleteListener = (deletedCollectionId: string) => void;

class CollectionService {
  private pendingColPromises = new Map<string, Promise<Collection>>();
  private deleteListeners = new Set<CollectionDeleteListener>();

  /**
   * Subscribe to collection deletion events.
   * Returns an unsubscribe function.
   */
  onCollectionDeleted(listener: CollectionDeleteListener): () => void {
    this.deleteListeners.add(listener);
    return () => {
      this.deleteListeners.delete(listener);
    };
  }

  /**
   * Normalizes a collection name to a trimmed lowercase key for comparison and deduplication.
   * Note: Collections preserve user casing for display (e.g. "Nghiên cứu AI"),
   * while comparison and uniqueness checks use this normalized key.
   */
  normalizeCollectionName(name: string): string {
    return name.trim().toLowerCase();
  }

  deduplicateCollections(collections: Collection[]): Collection[] {
    const seen = new Set<string>();
    return collections.filter((col) => {
      const norm = this.normalizeCollectionName(col.name);
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }

  async getAllCollections(): Promise<Collection[]> {
    return collectionRepo.getAll();
  }

  async getCollectionById(id: string): Promise<Collection | undefined> {
    return collectionRepo.getById(id);
  }

  async createCollection(name: string): Promise<Collection> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Tên bộ sưu tập không được để trống');
    }
    const key = trimmed.toLowerCase();

    // Prevent concurrent duplicate creation
    if (this.pendingColPromises.has(key)) {
      return this.pendingColPromises.get(key)!;
    }

    const promise = (async () => {
      try {
        const existing = await collectionRepo.getByName(trimmed);
        if (existing) {
          return existing;
        }
        const collection: Collection = {
          id: crypto.randomUUID(),
          name: trimmed,
          createdAt: Date.now(),
        };
        await collectionRepo.add(collection);
        return collection;
      } finally {
        this.pendingColPromises.delete(key);
      }
    })();

    this.pendingColPromises.set(key, promise);
    return promise;
  }

  async updateCollection(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Tên bộ sưu tập không được để trống');
    await collectionRepo.update(id, { name: trimmed });
  }

  async deleteCollection(id: string): Promise<void> {
    try {
      // Atomic transaction for removing collection reference from items and deleting collection entity
      await db.transaction('rw', [db.items, db.collections], async () => {
        const items = await db.items.where('collections').equals(id).toArray();
        if (items.length > 0) {
          const now = Date.now();
          const updates = items.map((item) => ({
            key: item.id,
            changes: {
              collections: (item.collections || []).filter((c) => c !== id),
              updatedAt: now,
            },
          }));
          await db.items.bulkUpdate(updates);
        }
        await db.collections.delete(id);
      });
    } finally {
      // Always notify registered subscribers of collection deletion
      this.deleteListeners.forEach((listener) => {
        try {
          listener(id);
        } catch (err) {
          console.error('Error in CollectionService delete listener:', err);
        }
      });
    }
  }

  async getCollectionItems(collectionId: string): Promise<Item[]> {
    return db.items.where('collections').equals(collectionId).toArray();
  }

  async getCollectionItemCount(collectionId: string): Promise<number> {
    return db.items.where('collections').equals(collectionId).count();
  }

  async addItemToCollection(itemId: string, collectionId: string): Promise<void> {
    const item = await db.items.get(itemId);
    if (!item) return;
    const currentCols = item.collections || [];
    if (!currentCols.includes(collectionId)) {
      await db.items.update(itemId, {
        collections: Array.from(new Set([...currentCols, collectionId])),
        updatedAt: Date.now(),
      });
    }
  }

  async removeItemFromCollection(itemId: string, collectionId: string): Promise<void> {
    const item = await db.items.get(itemId);
    if (!item) return;
    await db.items.update(itemId, {
      collections: (item.collections || []).filter((c) => c !== collectionId),
      updatedAt: Date.now(),
    });
  }
}

export const collectionService = new CollectionService();

