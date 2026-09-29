import { db } from './database';
import { tagService } from '../services/TagService';
import { collectionService } from '../services/CollectionService';
import { itemService } from '../services/ItemService';
import { withCrossTabLock, broadcastMessage } from '../utils/crossTabLock';
import type { Item } from '../types/item';

const CLEANUP_STORAGE_KEY = 'kt_db_cleanup_meta_v1';

export interface DatabaseCleanupMeta {
  lastRunAt: number | null;
  schemaVersion: number;
  isDirty: boolean;
  lastMergedTagsCount?: number;
  lastMergedColsCount?: number;
}

export interface CleanupResult {
  mergedTagsCount: number;
  mergedColsCount: number;
  updatedItemsCount: number;
  skipped: boolean;
}

let seedExecutionPromise: Promise<void> | null = null;
let isSeededOrNotEmpty = false;
let isCleanupRunning = false;

const SEED_SUPPRESSED_KEY = 'kt_seed_suppressed';

/**
 * Suppresses automatic demo data seeding permanently.
 * Called after importing a backup to prevent demo data from resurrecting.
 */
export function suppressSeed(): void {
  isSeededOrNotEmpty = true;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SEED_SUPPRESSED_KEY, 'true');
    }
  } catch {
    // Non-fatal
  }
}

function isSeedSuppressed(): boolean {
  if (isSeededOrNotEmpty) return true;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(SEED_SUPPRESSED_KEY) === 'true') {
      isSeededOrNotEmpty = true;
      return true;
    }
  } catch {
    // Non-fatal
  }
  return false;
}

/**
 * Retrieves the database cleanup metadata from localStorage.
 */
export function getCleanupMeta(): DatabaseCleanupMeta {
  try {
    const raw = localStorage.getItem(CLEANUP_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Fallback if localStorage is restricted or throws
  }
  return {
    lastRunAt: null,
    schemaVersion: 0,
    isDirty: false,
  };
}

/**
 * Persists database cleanup metadata to localStorage.
 */
export function saveCleanupMeta(meta: DatabaseCleanupMeta): void {
  try {
    localStorage.setItem(CLEANUP_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Silently ignore storage quota or private-browsing errors
  }
}

/**
 * Marks the database as dirty so cleanup will be performed on the next background idle cycle.
 * Call this when batch importing external files or after bulk operations that may introduce duplicates.
 */
export function markDatabaseDirty(reason?: string): void {
  const meta = getCleanupMeta();
  meta.isDirty = true;
  saveCleanupMeta(meta);
  if (reason) {
    console.debug(`[DB Cleanup] Marked dirty: ${reason}`);
  }
}

/**
 * Determines whether cleanup is necessary.
 * Returns true if:
 * 1. Dirty flag is active.
 * 2. Cleanup has never executed previously.
 * 3. The current database schema version is greater than the schema version when cleanup last ran.
 */
export function isCleanupNeeded(): boolean {
  const meta = getCleanupMeta();
  if (meta.isDirty) return true;
  if (!meta.lastRunAt) return true;
  if (db.verno > meta.schemaVersion) return true;
  return false;
}

/**
 * Highly optimized database deduplication:
 * - Cross-tab mutex via Web Locks API / localStorage lease to prevent multi-tab race conditions.
 * - Double-checked locking to skip redundant execution if another tab just completed cleanup.
 * - O(T + C) memory grouping of tags and collections.
 * - Indexed O(M) retrieval of affected items via Dexie multi-entry index (`where('tags').anyOf(...)`).
 * - Atomically executed inside a Dexie transaction with bulk operations.
 * - Skips execution when no dirty flag or schema upgrade is detected.
 */
export async function cleanupDuplicateTagsAndCollections(force = false): Promise<CleanupResult> {
  // Fast pre-check before requesting cross-tab lock
  if (!force && !isCleanupNeeded()) {
    return { mergedTagsCount: 0, mergedColsCount: 0, updatedItemsCount: 0, skipped: true };
  }

  if (isCleanupRunning) {
    return { mergedTagsCount: 0, mergedColsCount: 0, updatedItemsCount: 0, skipped: true };
  }

  const lockRes = await withCrossTabLock(
    'kt_cleanup_duplicates_lock',
    async () => {
      // Re-check inside exclusive lock: another tab may have finished cleanup while we waited
      if (!force && !isCleanupNeeded()) {
        return { mergedTagsCount: 0, mergedColsCount: 0, updatedItemsCount: 0, skipped: true };
      }

      if (isCleanupRunning) {
        return { mergedTagsCount: 0, mergedColsCount: 0, updatedItemsCount: 0, skipped: true };
      }

      isCleanupRunning = true;
      let mergedTagsCount = 0;
      let mergedColsCount = 0;
      let updatedItemsCount = 0;

      try {
        // -----------------------------------------------------------------------
        // STEP 1: Fast O(T) detection of duplicate tags
        // -----------------------------------------------------------------------
        const allTags = await db.tags.toArray();
        const tagGroupMap = new Map<string, typeof allTags>();

        for (const tag of allTags) {
          const normalized = tagService.normalizeTagName(tag.name);
          if (!tagGroupMap.has(normalized)) {
            tagGroupMap.set(normalized, []);
          }
          tagGroupMap.get(normalized)!.push(tag);
        }

        const tagReplacementMap = new Map<string, string>(); // duplicateTagId -> primaryTagId
        const duplicateTagIds: string[] = [];

        for (const [, group] of tagGroupMap.entries()) {
          if (group.length > 1) {
            group.sort((a, b) => a.createdAt - b.createdAt);
            const primaryTag = group[0];
            const duplicates = group.slice(1);
            for (const dup of duplicates) {
              tagReplacementMap.set(dup.id, primaryTag.id);
              duplicateTagIds.push(dup.id);
            }
            mergedTagsCount += duplicates.length;
          }
        }

        // -----------------------------------------------------------------------
        // STEP 2: Fast O(C) detection of duplicate collections
        // -----------------------------------------------------------------------
        const allCols = await db.collections.toArray();
        const colGroupMap = new Map<string, typeof allCols>();

        for (const col of allCols) {
          const normalized = collectionService.normalizeCollectionName(col.name);
          if (!colGroupMap.has(normalized)) {
            colGroupMap.set(normalized, []);
          }
          colGroupMap.get(normalized)!.push(col);
        }

        const colReplacementMap = new Map<string, string>(); // duplicateColId -> primaryColId
        const duplicateColIds: string[] = [];

        for (const [, group] of colGroupMap.entries()) {
          if (group.length > 1) {
            group.sort((a, b) => a.createdAt - b.createdAt);
            const primaryCol = group[0];
            const duplicates = group.slice(1);
            for (const dup of duplicates) {
              colReplacementMap.set(dup.id, primaryCol.id);
              duplicateColIds.push(dup.id);
            }
            mergedColsCount += duplicates.length;
          }
        }

        // -----------------------------------------------------------------------
        // STEP 3: Atomic batch updates if duplicates were detected
        // -----------------------------------------------------------------------
        if (duplicateTagIds.length > 0 || duplicateColIds.length > 0) {
          await db.transaction('rw', [db.items, db.tags, db.collections], async () => {
            // Query ONLY items referencing duplicate IDs via multi-entry indexes
            const affectedItemMap = new Map<string, Item>();

            if (duplicateTagIds.length > 0) {
              const itemsWithDupTags = await db.items
                .where('tags')
                .anyOf(duplicateTagIds)
                .distinct()
                .toArray();
              for (const item of itemsWithDupTags) {
                affectedItemMap.set(item.id, item);
              }
            }

            if (duplicateColIds.length > 0) {
              const itemsWithDupCols = await db.items
                .where('collections')
                .anyOf(duplicateColIds)
                .distinct()
                .toArray();
              for (const item of itemsWithDupCols) {
                affectedItemMap.set(item.id, item);
              }
            }

            // Remap references & deduplicate arrays
            for (const item of affectedItemMap.values()) {
              let hasChanges = false;
              let newTags = item.tags;
              let newCols = item.collections;

              if (item.tags && item.tags.length > 0) {
                const mapped = item.tags.map((t) => tagReplacementMap.get(t) || t);
                const unique = Array.from(new Set(mapped));
                if (unique.length !== item.tags.length || unique.some((t, i) => t !== item.tags[i])) {
                  newTags = unique;
                  hasChanges = true;
                }
              }

              if (item.collections && item.collections.length > 0) {
                const mapped = item.collections.map((c) => colReplacementMap.get(c) || c);
                const unique = Array.from(new Set(mapped));
                if (unique.length !== item.collections.length || unique.some((c, i) => c !== item.collections[i])) {
                  newCols = unique;
                  hasChanges = true;
                }
              }

              if (hasChanges) {
                await db.items.update(item.id, {
                  tags: newTags,
                  collections: newCols,
                  updatedAt: Date.now(),
                });
                updatedItemsCount++;
              }
            }

            // Bulk delete duplicate entity records in single indexed operations
            if (duplicateTagIds.length > 0) {
              await db.tags.bulkDelete(duplicateTagIds);
            }
            if (duplicateColIds.length > 0) {
              await db.collections.bulkDelete(duplicateColIds);
            }
          });
        }

        // Persist completion state
        saveCleanupMeta({
          lastRunAt: Date.now(),
          schemaVersion: db.verno,
          isDirty: false,
          lastMergedTagsCount: mergedTagsCount,
          lastMergedColsCount: mergedColsCount,
        });

        // Notify other open tabs that deduplication finished
        broadcastMessage('KT_CLEANUP_COMPLETED', {
          lastRunAt: Date.now(),
          schemaVersion: db.verno,
        });

        return {
          mergedTagsCount,
          mergedColsCount,
          updatedItemsCount,
          skipped: false,
        };
      } catch (err) {
        console.warn('[DB Cleanup] Warning during database cleanup:', err);
        return { mergedTagsCount: 0, mergedColsCount: 0, updatedItemsCount: 0, skipped: false };
      } finally {
        isCleanupRunning = false;
      }
    },
    { ifAvailable: true }
  );

  if (!lockRes.acquired || !lockRes.result) {
    return { mergedTagsCount: 0, mergedColsCount: 0, updatedItemsCount: 0, skipped: true };
  }

  return lockRes.result;
}

export interface BackgroundCleanupReport {
  deduplication: CleanupResult;
  orphanedFilesCleaned: number;
  skipped: boolean;
}

/**
 * Executes background database and storage maintenance in strict sequential order:
 * 1. Acquires a cross-tab maintenance lock so multiple tabs never run cleanup in parallel.
 * 2. Runs tag & collection deduplication first, ensuring all db.items references are clean and committed.
 * 3. Once database items are stable and committed, runs orphaned OPFS file cleanup.
 */
export async function runCoordinatedCleanup(force = false): Promise<BackgroundCleanupReport> {
  const lockRes = await withCrossTabLock(
    'kt_bg_cleanup_pipeline_lock',
    async () => {
      // Step 1: Run tag & collection deduplication first (sequential await)
      const dedupResult = await cleanupDuplicateTagsAndCollections(force);

      // Step 2: Only after deduplication completes and commits, run orphaned file cleanup
      let filesCleaned = 0;
      try {
        filesCleaned = await itemService.cleanupPendingOrphanedFiles();
      } catch (err) {
        console.warn('[DB Cleanup] Orphaned files cleanup error:', err);
      }

      return {
        deduplication: dedupResult,
        orphanedFilesCleaned: filesCleaned,
        skipped: false,
      };
    },
    { ifAvailable: true }
  );

  if (!lockRes.acquired || !lockRes.result) {
    return {
      deduplication: { mergedTagsCount: 0, mergedColsCount: 0, updatedItemsCount: 0, skipped: true },
      orphanedFilesCleaned: 0,
      skipped: true,
    };
  }

  return lockRes.result;
}

/**
 * Schedules database cleanup as a non-blocking background job.
 * Runs during browser idle periods (requestIdleCallback) or after an idle timeout.
 * Never blocks startup rendering or initial user interactions.
 */
export function scheduleBackgroundCleanup(delayMs = 2000): void {
  const executePipeline = async () => {
    try {
      await runCoordinatedCleanup();
    } catch (err) {
      console.warn('[DB Cleanup] Coordinated background cleanup error:', err);
    }
  };

  const scheduleTask = () => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(
        () => {
          executePipeline().catch(() => {});
        },
        { timeout: 5000 }
      );
    } else {
      setTimeout(() => {
        executePipeline().catch(() => {});
      }, 0);
    }
  };

  setTimeout(scheduleTask, delayMs);
}

/**
 * Seeds initial demo data if the database is completely empty.
 * Uses cross-tab lock to prevent race conditions when multiple tabs open concurrently on first visit.
 * Fast O(1) count check: returns immediately if items already exist.
 * Does NOT run heavy cleanup on startup.
 */
export async function seedInitialDataIfEmpty(): Promise<void> {
  if (isSeedSuppressed()) {
    return;
  }

  if (seedExecutionPromise) {
    return seedExecutionPromise;
  }

  seedExecutionPromise = (async () => {
    await withCrossTabLock('kt_seed_initial_data_lock', async () => {
      try {
        // Fast check: O(1) query to verify whether database has items
        const itemCount = await db.items.count();
        if (itemCount > 0) {
          isSeededOrNotEmpty = true;
          return;
        }

        // Fresh empty database: create initial clean tags
        const tagKientruc = await tagService.getOrCreateTag('kientruc');
        const tagPwa = await tagService.getOrCreateTag('pwa');
        const tagHuongdan = await tagService.getOrCreateTag('huongdan');

        // Create initial collection
        const col = await collectionService.createCollection('Khởi đầu nhanh');

        // 1. Welcome Note with Markdown
        await itemService.createItem(
          {
            type: 'note',
            title: 'Chào mừng đến với Kho Tri Thức Cá Nhân',
            body: `# Kho Tri Thức Cá Nhân (Local-First PWA)

Ứng dụng ghi chú và lưu trữ tri thức cá nhân hoạt động **hoàn toàn trên thiết bị của bạn**, không cần đăng nhập, không có máy chủ trung gian, bảo mật tuyệt đối.

## 🚀 Các tính năng chính:
- **Local-First & Offline**: Dữ liệu lưu trong IndexedDB & OPFS tốc độ cao.
- **Hộp chờ (Inbox)**: Lưu nhanh các ý tưởng hoặc liên kết, phân loại và "Giữ lâu dài" sau.
- **Phân loại linh hoạt**: Gắn thẻ \`#tag\`, gom vào **Bộ sưu tập**, ghim lên đầu trang.
- **Đa định dạng**: Hỗ trợ Ghi chú Markdown, Tệp (PDF, Ảnh, Markdown) và Liên kết Web.
- **Tìm kiếm toàn văn**: Tìm kiếm tức thì với công nghệ MiniSearch tối ưu tiếng Việt.

---
Thử tạo một ghi chú mới bằng nút **+** ở thanh điều hướng!`,
            tags: [tagHuongdan.id, tagPwa.id],
            collections: [col.id],
            isPinned: true,
          },
          true // saved
        );

        // 2. Technical Note about Architecture
        await itemService.createItem(
          {
            type: 'note',
            title: 'Kiến trúc Blueprint Local-First',
            body: `## Nguyên tắc cốt lõi:
1. **Không phụ thuộc đám mây**: Thiết bị là nguồn chân lý duy nhất.
2. **Tốc độ phản hồi tức thì**: Sử dụng MiniSearch in-memory index cho kết quả tìm kiếm theo thời gian thực.
3. **An toàn dữ liệu**: Hỗ trợ OPFS (Origin Private File System) lưu trữ nhị phân an toàn.`,
            tags: [tagKientruc.id, tagPwa.id],
            collections: [col.id],
            isPinned: false,
          },
          true // saved
        );

        // 3. Sample Link Item in Inbox
        await itemService.createItem(
          {
            type: 'link',
            title: 'Web.dev - Local-first Web Architecture',
            url: 'https://web.dev/explore/progressive-web-apps',
            reason: 'Tài liệu hướng dẫn chuyên sâu về kiến trúc PWA và lưu trữ ngoại tuyến hiện đại.',
            tags: [tagPwa.id],
            collections: [],
            isPinned: false,
          },
          false // in inbox
        );

        // Fresh seed data is pristine; mark cleanup as complete
        saveCleanupMeta({
          lastRunAt: Date.now(),
          schemaVersion: db.verno,
          isDirty: false,
        });

        isSeededOrNotEmpty = true;
      } catch (err) {
        console.warn('Seed data initial skipped:', err);
      }
    });
  })().finally(() => {
    seedExecutionPromise = null;
  });

  return seedExecutionPromise;
}
