import { db } from '../db/database';
import { fileStorage } from '../db/opfs';
import { fileService } from '../services/FileService';
import { itemService } from '../services/ItemService';
import { searchService } from '../services/SearchService';
import { pendingFileTracker } from '../services/PendingFileTracker';
import { markDatabaseDirty, suppressSeed } from '../db/seed';
import { useLibraryStore } from '../store/libraryStore';
import { withCrossTabLock, broadcastMessage } from '../utils/crossTabLock';
import {
  BACKUP_LOCKS,
  BATCH_METADATA_THRESHOLD_BYTES,
  BATCH_SIZE,
} from './constants';
import { BackupError } from './errors';
import { BackupContainerReader } from './container';
import { resolveConflict } from './sanitize';
import { recordLastImport } from './backupMeta';
import type {
  AnalyzeResult,
  ImportOptions,
  ImportReport,
  BackupTrailer,
  BackupTrailerBlob,
} from './types';
import type { Item, FileItem } from '../types/item';

export class BackupImporter {
  async importBackup(
    file: File,
    analysis: AnalyzeResult,
    options: ImportOptions
  ): Promise<ImportReport> {
    const { signal, onProgress, mode, conflict } = options;

    if (signal?.aborted) {
      throw new BackupError('ABORTED');
    }

    // 1. Acquire exclusive cross-tab lock with 30-minute lease
    const lockRes = await withCrossTabLock(
      BACKUP_LOCKS.CLEANUP_PIPELINE,
      async () => {
        return await this.executeImport(file, analysis, options);
      },
      { leaseMs: 30 * 60 * 1000, ifAvailable: true }
    );

    if (!lockRes.acquired || !lockRes.result) {
      throw new BackupError('LOCK_UNAVAILABLE');
    }

    return lockRes.result;
  }

  private async executeImport(
    file: File,
    analysis: AnalyzeResult,
    options: ImportOptions
  ): Promise<ImportReport> {
    const startTime = Date.now();
    const { signal, onProgress, mode, conflict } = options;

    const newlyCreatedOpfsPaths: string[] = [];
    const pathRemap = new Map<string, string>(); // originalPath -> newUniquePath

    let blobsStored = 0;
    let blobsReused = 0;
    let blobsRenamed = 0;

    const trailerHolder: { current: BackupTrailer | null } = { current: null };
    const blobSizesReceived = new Map<string, number>();

    // Collect pre-import active paths if replacing
    const oldReferencedPaths = new Set<string>();
    if (mode === 'replace') {
      try {
        const currentFileItems = (await db.items.where('type').equals('file').toArray()) as FileItem[];
        for (const item of currentFileItems) {
          if (item.opfsPath) oldReferencedPaths.add(item.opfsPath);
          if (item.thumbnailBlobUrl) oldReferencedPaths.add(item.thumbnailBlobUrl);
          if (item.files) {
            for (const f of item.files) {
              if (f.opfsPath) oldReferencedPaths.add(f.opfsPath);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to query current file items before replace:', err);
      }
    }

    // Attach beforeunload guard to protect against accidental tab closing during write
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Quá trình khôi phục đang diễn ra, vui lòng không đóng trang.';
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    try {
      onProgress?.({
        phase: 'staging',
        message: 'Đang giải nén và kiểm tra tệp đính kèm...',
        percent: 10,
      });

      // 2. Streamingly read and stage blobs from archive
      await BackupContainerReader.readFullArchive(
        file,
        {
          onMetadata: async () => {
            // Already analyzed
          },
          onBlob: async (originalPath: string, blob: Blob) => {
            if (signal?.aborted) {
              throw new BackupError('ABORTED');
            }

            blobSizesReceived.set(originalPath, blob.size);

            const exists = await fileStorage.exists(originalPath);
            if (exists) {
              const currentSize = await fileStorage.getSize(originalPath);
              if (currentSize === blob.size) {
                // Exact file match: safe to reuse without writing
                blobsReused++;
                return;
              }

              // File with same name but different size exists: write under new unique name to avoid overwriting local data
              const ext = originalPath.includes('.')
                ? originalPath.substring(originalPath.lastIndexOf('.'))
                : '';
              const newSafeName = `${crypto.randomUUID()}${ext}`;

              pendingFileTracker.markInFlight(newSafeName);
              newlyCreatedOpfsPaths.push(newSafeName);
              await pendingFileTracker.record(newSafeName);

              await fileStorage.storeFile(blob, newSafeName);
              pathRemap.set(originalPath, newSafeName);
              blobsRenamed++;
              blobsStored++;
            } else {
              // Write file to target path
              pendingFileTracker.markInFlight(originalPath);
              newlyCreatedOpfsPaths.push(originalPath);
              await pendingFileTracker.record(originalPath);

              await fileStorage.storeFile(blob, originalPath);
              blobsStored++;
            }

            onProgress?.({
              phase: 'staging',
              message: `Đang lưu tệp đính kèm (${blobsStored + blobsReused}/${analysis.parsedBlobsCount})...`,
              doneBlobs: blobsStored + blobsReused,
              totalBlobs: analysis.parsedBlobsCount,
            });
          },
          onTrailer: async (trailer: BackupTrailer) => {
            trailerHolder.current = trailer;
          },
        },
        signal
      );

      // 3. Verify trailer completeness and size consistency
      onProgress?.({
        phase: 'verify',
        message: 'Đang xác minh tính toàn vẹn của bản sao lưu...',
        percent: 60,
      });

      const trailer = trailerHolder.current;
      if (!trailer || trailer.complete !== true) {
        throw new BackupError('ARCHIVE_INCOMPLETE');
      }

      // Check blob sizes against trailer
      if (trailer.blobs && Array.isArray(trailer.blobs)) {
        for (const tb of trailer.blobs as BackupTrailerBlob[]) {
          if (tb.status === 'ok') {
            const actualSize = blobSizesReceived.get(tb.path);
            if (actualSize !== undefined && actualSize !== tb.size) {
              throw new BackupError('BLOB_SIZE_MISMATCH', {
                path: tb.path,
                expected: tb.size,
                actual: actualSize,
              });
            }
          }
        }
      }

      // 4. Remap file paths in items if any blobs were renamed
      const itemsToCommit: Item[] = [];
      for (const item of analysis.parsedItems) {
        if (item.type !== 'file' || pathRemap.size === 0) {
          itemsToCommit.push(item);
          continue;
        }

        const fileItem = { ...item } as FileItem;
        if (fileItem.opfsPath && pathRemap.has(fileItem.opfsPath)) {
          fileItem.opfsPath = pathRemap.get(fileItem.opfsPath)!;
        }
        if (fileItem.thumbnailBlobUrl && pathRemap.has(fileItem.thumbnailBlobUrl)) {
          fileItem.thumbnailBlobUrl = pathRemap.get(fileItem.thumbnailBlobUrl)!;
        }
        if (fileItem.files && fileItem.files.length > 0) {
          fileItem.files = fileItem.files.map((f) => {
            if (f.opfsPath && pathRemap.has(f.opfsPath)) {
              return { ...f, opfsPath: pathRemap.get(f.opfsPath)! };
            }
            return f;
          });
        }
        itemsToCommit.push(fileItem);
      }

      // 5. Database Commit Phase (Atomic / Batched)
      onProgress?.({
        phase: 'commit',
        message: 'Đang lưu dữ liệu vào cơ sở dữ liệu...',
        percent: 75,
      });

      let itemsAdded = 0;
      let itemsUpdated = 0;
      let itemsSkipped = 0;
      const supersededItems: Item[] = [];

      const useBatchedCommit =
        analysis.manifest.sizes.metadataBytes > BATCH_METADATA_THRESHOLD_BYTES;

      if (mode === 'replace') {
        // REPLACE MODE
        if (useBatchedCommit) {
          // Clear tables in small transactions
          await db.transaction('rw', [db.items, db.tags, db.collections], async () => {
            await db.tags.clear();
            await db.collections.clear();
            await db.items.clear();
          });

          // Insert tags & collections
          if (analysis.parsedTags.length > 0) {
            await db.tags.bulkAdd(analysis.parsedTags);
          }
          if (analysis.parsedCollections.length > 0) {
            await db.collections.bulkAdd(analysis.parsedCollections);
          }

          // Batched insert of items
          for (let i = 0; i < itemsToCommit.length; i += BATCH_SIZE) {
            const batch = itemsToCommit.slice(i, i + BATCH_SIZE);
            await db.items.bulkAdd(batch);
            await new Promise((r) => setTimeout(r, 0)); // yield
          }
        } else {
          // Fully atomic replace transaction
          await db.transaction('rw', [db.items, db.tags, db.collections], async () => {
            await db.tags.clear();
            await db.collections.clear();
            await db.items.clear();

            if (analysis.parsedTags.length > 0) {
              await db.tags.bulkAdd(analysis.parsedTags);
            }
            if (analysis.parsedCollections.length > 0) {
              await db.collections.bulkAdd(analysis.parsedCollections);
            }
            if (itemsToCommit.length > 0) {
              await db.items.bulkAdd(itemsToCommit);
            }
          });
        }
        itemsAdded = itemsToCommit.length;
      } else {
        // MERGE MODE
        const localItems = await db.items.toArray();
        const localItemMap = new Map<string, Item>(localItems.map((i) => [i.id, i]));

        const winnersToCommit: Item[] = [];

        for (const incoming of itemsToCommit) {
          const local = localItemMap.get(incoming.id);
          if (!local) {
            winnersToCommit.push(incoming);
            itemsAdded++;
          } else {
            const { winner, superseded } = resolveConflict(local, incoming, conflict);
            if (winner === incoming) {
              winnersToCommit.push(winner);
              itemsUpdated++;
              if (superseded) {
                supersededItems.push(superseded);
              }
            } else {
              itemsSkipped++;
            }
          }
        }

        if (useBatchedCommit) {
          if (analysis.parsedTags.length > 0) {
            await db.tags.bulkPut(analysis.parsedTags);
          }
          if (analysis.parsedCollections.length > 0) {
            await db.collections.bulkPut(analysis.parsedCollections);
          }
          for (let i = 0; i < winnersToCommit.length; i += BATCH_SIZE) {
            const batch = winnersToCommit.slice(i, i + BATCH_SIZE);
            await db.items.bulkPut(batch);
            await new Promise((r) => setTimeout(r, 0));
          }
        } else {
          await db.transaction('rw', [db.items, db.tags, db.collections], async () => {
            if (analysis.parsedTags.length > 0) {
              await db.tags.bulkPut(analysis.parsedTags);
            }
            if (analysis.parsedCollections.length > 0) {
              await db.collections.bulkPut(analysis.parsedCollections);
            }
            if (winnersToCommit.length > 0) {
              await db.items.bulkPut(winnersToCommit);
            }
          });
        }
      }

      // 6. Post-Commit Phase
      onProgress?.({
        phase: 'post',
        message: 'Đang cập nhật chỉ mục tìm kiếm và hoàn tất...',
        percent: 90,
      });

      // Untrack staged files from pending cleanups
      if (newlyCreatedOpfsPaths.length > 0) {
        await pendingFileTracker.clear(newlyCreatedOpfsPaths);
      }

      // Safe cleanup of abandoned paths
      if (mode === 'replace' && oldReferencedPaths.size > 0) {
        const newReferencedPaths = new Set<string>();
        for (const item of itemsToCommit) {
          if (item.type === 'file') {
            const f = item as FileItem;
            if (f.opfsPath) newReferencedPaths.add(f.opfsPath);
            if (f.thumbnailBlobUrl) newReferencedPaths.add(f.thumbnailBlobUrl);
            if (f.files) {
              for (const sf of f.files) {
                if (sf.opfsPath) newReferencedPaths.add(sf.opfsPath);
              }
            }
          }
        }

        for (const oldPath of oldReferencedPaths) {
          if (!newReferencedPaths.has(oldPath)) {
            const isReferenced = await itemService.isPathReferencedInDb(oldPath);
            if (!isReferenced) {
              try {
                await fileService.deleteFile(oldPath);
              } catch (delErr) {
                console.warn('Failed to delete orphaned file in replace:', oldPath, delErr);
              }
            }
          }
        }
      } else if (mode === 'merge' && conflict === 'overwrite' && supersededItems.length > 0) {
        // Overwrite mode: delete files solely owned by superseded items if not referenced
        for (const item of supersededItems) {
          if (item.type === 'file') {
            const f = item as FileItem;
            const pathsToCheck = [
              f.opfsPath,
              f.thumbnailBlobUrl,
              ...(f.files?.map((sf) => sf.opfsPath) || []),
            ].filter(Boolean) as string[];

            for (const p of pathsToCheck) {
              const isReferenced = await itemService.isPathReferencedInDb(p);
              if (!isReferenced) {
                try {
                  await fileService.deleteFile(p);
                } catch {
                  // Non-fatal
                }
              }
            }
          }
        }
      }

      // Rebuild search index
      try {
        searchService.invalidateTagCache();
        await searchService.rebuildIndex();
      } catch (searchErr) {
        console.warn('Search index rebuild warning after import:', searchErr);
      }

      // Mark database dirty for background cleanup
      markDatabaseDirty('backup-import');

      // Broadcast to other tabs
      broadcastMessage('KT_IMPORT_COMPLETED', { at: Date.now() });

      // If replace: reset library store active filters
      if (mode === 'replace') {
        try {
          useLibraryStore.getState().clearFilters();
        } catch {
          // Non-fatal
        }
      }

      // Suppress demo data seed
      suppressSeed();

      // Record last import timestamp
      recordLastImport();

      const durationMs = Date.now() - startTime;

      return {
        mode,
        conflict,
        durationMs,
        itemsAdded,
        itemsUpdated,
        itemsSkipped,
        tagsCreated: analysis.parsedTags.length,
        tagsMerged: analysis.tagsToRemapCount,
        collectionsCreated: analysis.parsedCollections.length,
        collectionsMerged: analysis.collectionsToRemapCount,
        blobsStored,
        blobsReused,
        blobsRenamed,
        warnings: analysis.warnings,
        errors: [],
      };
    } catch (err) {
      // Rollback only newly created files staged in this session
      if (newlyCreatedOpfsPaths.length > 0) {
        try {
          await pendingFileTracker.rollback(newlyCreatedOpfsPaths);
        } catch (rbErr) {
          console.warn('Rollback error after import failure:', rbErr);
        }
      }
      throw err;
    } finally {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    }
  }
}

export const backupImporter = new BackupImporter();
