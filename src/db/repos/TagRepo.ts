import { db } from '../database';
import type { Tag } from '../../types/tag';

export class TagRepo {
  private normalize(name: string): string {
    return name.toLowerCase().trim().replace(/^#+/, '').replace(/\s+/g, '-');
  }

  async getById(id: string): Promise<Tag | undefined> {
    return db.tags.get(id);
  }

  async getByName(name: string): Promise<Tag | undefined> {
    const normalized = this.normalize(name);
    if (!normalized) return undefined;
    const directMatch = await db.tags.where('name').equals(normalized).first();
    if (directMatch) return directMatch;

    // Fallback in-memory normalized scan
    const all = await db.tags.toArray();
    return all.find((t) => this.normalize(t.name) === normalized);
  }

  async getAll(): Promise<Tag[]> {
    return db.tags.orderBy('name').toArray();
  }

  async add(tag: Tag): Promise<string> {
    const cleanName = this.normalize(tag.name);
    return db.tags.add({ ...tag, name: cleanName });
  }

  async update(id: string, patch: Partial<Tag>): Promise<number> {
    const cleanPatch = { ...patch };
    if (cleanPatch.name) {
      cleanPatch.name = this.normalize(cleanPatch.name);
    }
    return db.tags.update(id, cleanPatch);
  }

  async delete(id: string): Promise<void> {
    return db.tags.delete(id);
  }
}

export const tagRepo = new TagRepo();

