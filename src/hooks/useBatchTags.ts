import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Item } from '../types/item';
import type { Tag } from '../types/tag';

/**
 * Batches tag loading for a collection of visible items.
 * Replaces the N+1 `useLiveQuery` pattern in individual cards with
 * a single query observing only the visible items' tags.
 */
export function useBatchTags(items: Item[]): Map<string, Tag> {
  // Stable key: sorted unique tag IDs across all provided items
  const tagIdsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const item of items) {
      if (item && item.tags && Array.isArray(item.tags)) {
        for (const tid of item.tags) {
          if (tid) ids.add(tid);
        }
      }
    }
    if (ids.size === 0) return '';
    return Array.from(ids).sort().join(',');
  }, [items]);

  const tagMap = useLiveQuery(
    async () => {
      if (!tagIdsKey) {
        return new Map<string, Tag>();
      }
      const ids = tagIdsKey.split(',').filter(Boolean);
      if (ids.length === 0) {
        return new Map<string, Tag>();
      }
      const tags = await db.tags.where('id').anyOf(ids).toArray();
      const map = new Map<string, Tag>();
      for (const tag of tags) {
        map.set(tag.id, tag);
      }
      return map;
    },
    [tagIdsKey]
  );

  return tagMap ?? new Map<string, Tag>();
}
