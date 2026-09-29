import { db } from '../database';
import type { Item, NoteItem, LinkItem } from '../../types/item';

export class ItemRepo {
  async getById(id: string): Promise<Item | undefined> {
    return db.items.get(id);
  }

  async getAll(): Promise<Item[]> {
    return db.items.toArray();
  }

  async getByStatus(status: 'saved' | 'inbox'): Promise<Item[]> {
    return db.items.where('status').equals(status).toArray();
  }

  async getByStatusAndType(status: 'saved' | 'inbox', type: 'note' | 'file' | 'link'): Promise<Item[]> {
    return db.items.where('[status+type]').equals([status, type]).toArray();
  }

  async getSaved(): Promise<Item[]> {
    return this.getByStatus('saved');
  }

  async getInbox(): Promise<Item[]> {
    return this.getByStatus('inbox');
  }

  async add(item: Item): Promise<string> {
    return db.items.add(item);
  }

  async update(id: string, patch: Partial<Item>): Promise<number> {
    return db.items.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    return db.items.delete(id);
  }

  async getByTag(tagId: string): Promise<Item[]> {
    return db.items.where('tags').equals(tagId).toArray();
  }

  async getByCollection(collectionId: string): Promise<Item[]> {
    return db.items.where('collections').equals(collectionId).toArray();
  }

  async getAllNotes(): Promise<NoteItem[]> {
    const items = await db.items.where('type').equals('note').toArray();
    return items as NoteItem[];
  }

  async getByNormalizedTitle(normalizedTitle: string): Promise<Item | undefined> {
    return db.items.where('normalizedTitle').equals(normalizedTitle).first();
  }

  async getNoteByNormalizedTitle(normalizedTitle: string): Promise<NoteItem | undefined> {
    return db.items.where('[type+normalizedTitle]').equals(['note', normalizedTitle]).first() as Promise<NoteItem | undefined>;
  }

  async getLinksByUrls(urls: string[]): Promise<LinkItem[]> {
    if (!urls || urls.length === 0) return [];
    return db.items.where('url').anyOf(urls).toArray() as Promise<LinkItem[]>;
  }
}

export const itemRepo = new ItemRepo();
