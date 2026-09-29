import { tagRepo } from '../db/repos/TagRepo';
import { db } from '../db/database';
import type { Tag } from '../types/tag';
import type { Item } from '../types/item';
import { searchService } from './SearchService';

export type TagDeleteListener = (deletedTagId: string) => void;

class TagService {
  private pendingTagPromises = new Map<string, Promise<Tag>>();
  private deleteListeners = new Set<TagDeleteListener>();

  /**
   * Subscribe to tag deletion events.
   * Returns an unsubscribe function.
   */
  onTagDeleted(listener: TagDeleteListener): () => void {
    this.deleteListeners.add(listener);
    return () => {
      this.deleteListeners.delete(listener);
    };
  }

  normalizeTagName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/^#+|#+$/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  deduplicateTags(tags: Tag[]): Tag[] {
    const seen = new Set<string>();
    return tags.filter((tag) => {
      const norm = this.normalizeTagName(tag.name);
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }

  async getAllTags(): Promise<Tag[]> {
    return tagRepo.getAll();
  }

  async getTagById(id: string): Promise<Tag | undefined> {
    return tagRepo.getById(id);
  }

  async getOrCreateTag(rawName: string): Promise<Tag> {
    const clean = this.normalizeTagName(rawName);
    if (!clean) {
      throw new Error('Tên thẻ không hợp lệ');
    }
    if (clean.length > 50) {
      throw new Error('Tên thẻ không được dài quá 50 ký tự');
    }

    // Reuse existing in-flight creation promise to prevent concurrency race conditions
    if (this.pendingTagPromises.has(clean)) {
      return this.pendingTagPromises.get(clean)!;
    }

    const promise = (async () => {
      try {
        const existing = await tagRepo.getByName(clean);
        if (existing) {
          searchService.setTagInCache(existing.id, existing.name);
          return existing;
        }

        const newTag: Tag = {
          id: crypto.randomUUID(),
          name: clean,
          createdAt: Date.now(),
        };
        await tagRepo.add(newTag);
        searchService.setTagInCache(newTag.id, newTag.name);
        return newTag;
      } finally {
        this.pendingTagPromises.delete(clean);
      }
    })();

    this.pendingTagPromises.set(clean, promise);
    return promise;
  }

  async updateTag(id: string, rawName: string): Promise<void> {
    const clean = this.normalizeTagName(rawName);
    if (!clean) {
      throw new Error('Tên thẻ không hợp lệ');
    }
    if (clean.length > 50) {
      throw new Error('Tên thẻ không được dài quá 50 ký tự');
    }

    const existing = await tagRepo.getByName(clean);
    if (existing && existing.id !== id) {
      throw new Error('Thẻ với tên này đã tồn tại');
    }

    await tagRepo.update(id, { name: clean });
    searchService.setTagInCache(id, clean);
    searchService.invalidateTagCache();

    // Reindex items referencing this tag so MiniSearch receives updated tag name
    try {
      const items = await db.items.where('tags').equals(id).toArray();
      if (items.length > 0) {
        await searchService.updateMany(items);
      }
    } catch (err) {
      console.error('Error updating search index after tag rename:', err);
    }
  }

  async deleteTag(id: string): Promise<void> {
    const updatedItems: Item[] = [];

    // Atomic transaction for removing tag reference from items and deleting tag entity
    await db.transaction('rw', [db.items, db.tags], async () => {
      const items = await db.items.where('tags').equals(id).toArray();
      if (items.length > 0) {
        const now = Date.now();
        const updates = items.map((item) => {
          const updatedTags = (item.tags || []).filter((t) => t !== id);
          const updatedItem: Item = { ...item, tags: updatedTags, updatedAt: now };
          updatedItems.push(updatedItem);
          return {
            key: item.id,
            changes: { tags: updatedTags, updatedAt: now },
          };
        });
        await db.items.bulkUpdate(updates);
      }
      await db.tags.delete(id);
    });

    try {
      // Update in-memory search caches and reindex items only after transaction successfully commits
      searchService.removeTagFromCache(id);
      searchService.invalidateTagCache();
      if (updatedItems.length > 0) {
        await searchService.updateMany(updatedItems);
      }
    } catch (err) {
      console.error('Error updating search index after tag deletion:', err);
    } finally {
      // Notify registered subscribers of tag deletion (e.g. UI stores, filters)
      this.deleteListeners.forEach((listener) => {
        try {
          listener(id);
        } catch (err) {
          console.error('Error in TagService delete listener:', err);
        }
      });
    }
  }

  async getTagItemCount(tagId: string): Promise<number> {
    return db.items.where('tags').equals(tagId).count();
  }
}

export const tagService = new TagService();

