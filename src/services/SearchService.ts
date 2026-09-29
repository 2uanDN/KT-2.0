import MiniSearch, { type SearchResult } from 'minisearch';
import type { Item, NoteItem, FileItem, LinkItem } from '../types/item';
import { db } from '../db/database';
import {
  tokenizeVietnamese,
  removeVietnameseAccents,
  cleanMarkdownForSearch,
} from '../utils/vietnamese';

export type { SearchResult } from 'minisearch';

export interface SearchFilter {
  type?: string;
  status?: string;
}

export interface IndexedDocument {
  id: string;
  type: string;
  status: string;
  title: string;
  tags?: string;
  body?: string;
  caption?: string;
  reason?: string;
  originalFilename?: string;
  domain?: string;
}

class SearchService {
  private index: MiniSearch<IndexedDocument>;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private tagMapCache = new Map<string, string>();
  private lastTagCacheUpdate = 0;
  private discardedCount = 0;
  private tagRefreshPromise: Promise<void> | null = null;
  private shouldLimitDeepBody = false;

  constructor() {
    this.index = new MiniSearch<IndexedDocument>({
      fields: ['title', 'tags', 'body', 'caption', 'reason', 'originalFilename', 'domain'],
      // Minimal storeFields reduces in-memory footprint across thousands of documents
      storeFields: ['id', 'type', 'status'],
      searchOptions: {
        boost: {
          title: 4,
          tags: 3,
          caption: 2,
          reason: 2,
          originalFilename: 2,
          domain: 1.5,
          body: 1,
        },
        fuzzy: 0.2,
        prefix: true,
      },
      tokenize: tokenizeVietnamese,
    });
  }

  /**
   * Refreshes the internal tag cache from database.
   * If `force` is true or cache was invalidated (lastTagCacheUpdate === 0),
   * it unconditionally queries Dexie.
   * Concurrent invocations share the in-flight promise to avoid duplicate DB queries.
   */
  async refreshTagMap(force = false): Promise<void> {
    const now = Date.now();
    if (!force && this.tagMapCache.size > 0 && this.lastTagCacheUpdate > 0 && now - this.lastTagCacheUpdate < 30000) {
      return;
    }
    if (this.tagRefreshPromise) {
      return this.tagRefreshPromise;
    }

    this.tagRefreshPromise = (async () => {
      try {
        const allTags = await db.tags.toArray();
        this.tagMapCache.clear();
        for (const t of allTags) {
          this.tagMapCache.set(t.id, t.name);
        }
        this.lastTagCacheUpdate = Date.now();
      } catch {
        // Non-fatal
      } finally {
        this.tagRefreshPromise = null;
      }
    })();

    return this.tagRefreshPromise;
  }

  /**
   * Marks tag cache as stale so subsequent search or refresh will re-query the database.
   */
  invalidateTagCache(): void {
    this.lastTagCacheUpdate = 0;
  }

  /**
   * Immediately registers or updates a tag in the search cache.
   * Eliminates the stale cache window when tags are created or updated.
   */
  setTagInCache(id: string, name: string): void {
    this.tagMapCache.set(id, name);
  }

  /**
   * Immediately removes a tag from the search cache.
   */
  removeTagFromCache(id: string): void {
    this.tagMapCache.delete(id);
  }

  /**
   * Ensures all provided tag IDs are present in the in-memory cache before indexing.
   */
  async ensureTagsCached(tagIds?: string[]): Promise<void> {
    if (!tagIds || tagIds.length === 0) return;
    const missing = tagIds.filter((id) => !this.tagMapCache.has(id));
    if (missing.length === 0) return;

    try {
      const tags = await db.tags.where('id').anyOf(missing).toArray();
      for (const t of tags) {
        this.tagMapCache.set(t.id, t.name);
      }
    } catch {
      // Non-fatal fallback
      await this.refreshTagMap(true);
    }
  }

  /**
   * Initializes search index using streaming chunked batches and event-loop yielding.
   * Prevents loading the entire database into RAM at once, keeping peak heap usage low
   * even for libraries with thousands of notes on mobile devices.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await this.refreshTagMap();
        this.index.removeAll();
        this.discardedCount = 0;

        const totalCount = await db.items.count();
        // Memory safeguard: For heavy libraries (>3000 items), cap indexed body length
        // to keep heap usage well below mobile browser memory pressure limits
        this.shouldLimitDeepBody = totalCount > 3000;
        if (totalCount === 0) {
          this.isInitialized = true;
          return;
        }

        const CHUNK_SIZE = 150;
        let lastId: string | null = null;

        while (true) {
          // Keyset-based cursor pagination on primary key 'id': O(log N) indexed seek per chunk
          // instead of Dexie's O(N) cursor.advance(offset) which yielded O(N²) scans.
          const chunk: Item[] = lastId
            ? await db.items.where('id').above(lastId).limit(CHUNK_SIZE).toArray()
            : await db.items.limit(CHUNK_SIZE).toArray();

          if (chunk.length === 0) break;

          const docs = chunk.map((item) => this.toDocument(item, this.shouldLimitDeepBody));
          this.index.addAll(docs);

          lastId = chunk[chunk.length - 1].id;
          if (chunk.length < CHUNK_SIZE) break;

          // Yield to event loop between chunks so:
          // 1. GC can reclaim previous chunk objects
          // 2. Main thread remains smooth and unblocked
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        this.isInitialized = true;
      } catch (err) {
        console.error('Failed to initialize search index:', err);
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  async add(item: Item): Promise<void> {
    await this.initialize();
    if (item.tags && item.tags.length > 0) {
      await this.ensureTagsCached(item.tags);
    }
    if (this.index.documentCount >= 3000) {
      this.shouldLimitDeepBody = true;
    }
    try {
      if (this.index.has(item.id)) {
        this.index.discard(item.id);
        this.checkVacuum();
      }
      this.index.add(this.toDocument(item, this.shouldLimitDeepBody));
    } catch {
      // Ignored
    }
  }

  async update(item?: Item | null): Promise<void> {
    if (!item) return;
    await this.initialize();
    if (item.tags && item.tags.length > 0) {
      await this.ensureTagsCached(item.tags);
    }
    if (this.index.documentCount >= 3000) {
      this.shouldLimitDeepBody = true;
    }
    try {
      if (this.index.has(item.id)) {
        this.index.discard(item.id);
        this.checkVacuum();
      }
      this.index.add(this.toDocument(item, this.shouldLimitDeepBody));
    } catch {
      // Ignored
    }
  }

  async updateMany(items: Item[]): Promise<void> {
    if (!items || items.length === 0) return;
    await this.initialize();

    const allTags = Array.from(new Set(items.flatMap((i) => i.tags || [])));
    if (allTags.length > 0) {
      await this.ensureTagsCached(allTags);
    }

    if (this.index.documentCount >= 3000) {
      this.shouldLimitDeepBody = true;
    }

    try {
      const docsToAdd: IndexedDocument[] = [];
      for (const item of items) {
        if (!item) continue;
        if (this.index.has(item.id)) {
          this.index.discard(item.id);
        }
        docsToAdd.push(this.toDocument(item, this.shouldLimitDeepBody));
      }
      this.checkVacuum();
      if (docsToAdd.length > 0) {
        this.index.addAll(docsToAdd);
      }
    } catch {
      // Ignored
    }
  }

  async remove(id: string): Promise<void> {
    await this.initialize();
    try {
      if (this.index.has(id)) {
        this.index.discard(id);
        this.checkVacuum();
      }
      if (this.index.documentCount <= 3000) {
        this.shouldLimitDeepBody = false;
      }
    } catch {
      // Ignored
    }
  }

  private checkVacuum(): void {
    this.discardedCount++;
    if (this.discardedCount >= 50) {
      this.discardedCount = 0;
      try {
        const result = this.index.vacuum();
        if (result instanceof Promise) {
          result.catch((err: unknown) => {
            console.warn('MiniSearch.vacuum failed:', err);
          });
        }
      } catch (err) {
        console.warn('MiniSearch.vacuum execution error:', err);
      }
    }
  }

  /**
   * Rebuilds the search index from database.
   * Cleans up all discarded document references and re-syncs state.
   */
  async rebuildIndex(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    this.isInitialized = false;
    return this.initialize();
  }

  /**
   * Two-Tier Search:
   * Tier 1: Instant in-memory MiniSearch with Vietnamese tokenization, fuzzy, prefix, and field boost.
   * Tier 2: Streaming IndexedDB deep scan fallback if few results are found, catching terms
   * beyond the truncated body limit without loading the full database into RAM.
   */
  async search(query: string, filter?: SearchFilter): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    await this.initialize();
    // Kick off refresh lazily in background, don't await to keep keystroke search latency at zero
    this.refreshTagMap().catch(() => {});

    try {
      // Tier 1: Try strict AND first for multi-word queries for precision
      let results: SearchResult[] = [];
      try {
        results = this.index.search(trimmed, { combineWith: 'AND' });
      } catch {
        results = this.index.search(trimmed);
      }

      // If strict AND returned no results, fall back to default OR
      if (results.length === 0) {
        results = this.index.search(trimmed);
      }

      if (filter?.type && filter.type !== 'all') {
        results = results.filter((r) => r.type === filter.type);
      }
      if (filter?.status) {
        results = results.filter((r) => r.status === filter.status);
      }

      // Tier 2: Deep search fallback if fewer than 5 results and query has >= 2 characters
      if (results.length < 5 && trimmed.length >= 2) {
        const existingIds = new Set(results.map((r) => r.id));
        const deepMatches = await this.searchDexieDeep(
          trimmed,
          existingIds,
          filter,
          10 - results.length
        );
        if (deepMatches.length > 0) {
          results = [...results, ...deepMatches];
        }
      }

      return results;
    } catch (err) {
      console.warn('MiniSearch error, falling back to direct database scan:', err);
      return this.searchDexieDeep(trimmed, new Set(), filter, 25);
    }
  }

  private async searchDexieDeep(
    query: string,
    excludeIds: Set<string>,
    filter?: SearchFilter,
    limit = 10
  ): Promise<SearchResult[]> {
    const normQuery = removeVietnameseAccents(query.toLowerCase());
    const deepResults: SearchResult[] = [];

    try {
      let collection = db.items.toCollection();
      if (filter?.status) {
        collection = db.items.where('status').equals(filter.status);
      }

      await collection
        .filter((item) => {
          if (deepResults.length >= limit) return false;
          if (excludeIds.has(item.id)) return false;
          if (filter?.type && filter.type !== 'all' && item.type !== filter.type) return false;

          // Check title
          const normTitle = removeVietnameseAccents(item.title.toLowerCase());
          if (normTitle.includes(normQuery)) return true;

          // Check tags
          if (item.tags && item.tags.length > 0) {
            for (const tagId of item.tags) {
              const tagName = this.tagMapCache.get(tagId);
              if (tagName && removeVietnameseAccents(tagName.toLowerCase()).includes(normQuery)) {
                return true;
              }
            }
          }

          // Check note body
          if (item.type === 'note') {
            const body = (item as NoteItem).body || '';
            const normBody = removeVietnameseAccents(body.toLowerCase());
            if (normBody.includes(normQuery)) return true;
          } else if (item.type === 'file') {
            const fi = item as FileItem;
            if (fi.caption && removeVietnameseAccents(fi.caption.toLowerCase()).includes(normQuery)) {
              return true;
            }
            if (fi.originalFilename && fi.originalFilename.toLowerCase().includes(normQuery)) {
              return true;
            }
          } else if (item.type === 'link') {
            const li = item as LinkItem;
            if (li.reason && removeVietnameseAccents(li.reason.toLowerCase()).includes(normQuery)) {
              return true;
            }
            if (li.domain && li.domain.toLowerCase().includes(normQuery)) {
              return true;
            }
          }

          return false;
        })
        .until(() => deepResults.length >= limit)
        .each((item) => {
          deepResults.push({
            id: item.id,
            score: 0.5,
            terms: [query],
            queryTerms: [query],
            match: {},
          } as SearchResult);
        });
    } catch (err) {
      console.warn('Deep search error:', err);
    }

    return deepResults;
  }

  toDocument(item: Item, limitDeepBody = this.shouldLimitDeepBody): IndexedDocument {
    let tagNames = '';
    if (item.tags && item.tags.length > 0) {
      tagNames = item.tags
        .map((id) => this.tagMapCache.get(id) || (id.includes('-') ? '' : id))
        .filter(Boolean)
        .join(' ');
    }

    const base: IndexedDocument = {
      id: item.id,
      type: item.type,
      status: item.status,
      title: item.title || '',
      tags: tagNames,
    };

    const maxBodyLen = limitDeepBody ? 1000 : 3000;

    if (item.type === 'note') {
      const rawBody = (item as NoteItem).body || '';
      base.body = cleanMarkdownForSearch(rawBody, maxBodyLen);
    } else if (item.type === 'file') {
      const fi = item as FileItem;
      base.caption = (fi.caption || '').slice(0, 1000);
      if (fi.files && fi.files.length > 0) {
        base.originalFilename = fi.files.map((f) => f.originalFilename).join(' ');
      } else {
        base.originalFilename = fi.originalFilename || '';
      }
    } else if (item.type === 'link') {
      const li = item as LinkItem;
      base.reason = (li.reason || '').slice(0, 1000);
      base.domain = li.domain || '';
    }

    return base;
  }
}

export const searchService = new SearchService();

