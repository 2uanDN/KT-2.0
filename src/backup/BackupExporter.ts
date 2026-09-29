import { db } from '../db/database';
import { fileStorage } from '../db/opfs';
import { withCrossTabLock } from '../utils/crossTabLock';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_MIN_READER_VERSION,
  APP_NAME,
  APP_BUILD,
  DB_SCHEMA_VERSION,
  MAX_METADATA_BYTES,
  ENTRY_NAMES,
  BACKUP_LOCKS,
} from './constants';
import { BackupError } from './errors';
import { BackupContainerWriter } from './container';
import { recordLastExport } from './backupMeta';
import type {
  ExportOptions,
  ExportResult,
  BackupManifest,
  BackupTrailer,
  BackupTrailerBlob,
} from './types';
import type { FileItem, Item, ItemType, ItemStatus } from '../types/item';
import type { Tag } from '../types/tag';
import type { Collection } from '../types/collection';

function generateBackupFilename(): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}-${pad(d.getMinutes())}`;
  return `KhoTriThuc-${dateStr}_${timeStr}.zip`;
}

export class BackupExporter {
  async exportBackup(options: ExportOptions): Promise<ExportResult> {
    const lockRes = await withCrossTabLock(
      BACKUP_LOCKS.EXPORT_MUTEX,
      async () => {
        return await this.executeExport(options);
      },
      { ifAvailable: true }
    );

    if (!lockRes.acquired || !lockRes.result) {
      throw new BackupError('LOCK_UNAVAILABLE');
    }

    return lockRes.result;
  }

  private async executeExport(options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    const { includeFiles, signal, writableStream, onProgress } = options;

    if (signal?.aborted) {
      throw new BackupError('ABORTED');
    }

    onProgress?.({
      phase: 'snapshot',
      message: 'Đang trích xuất dữ liệu cơ sở dữ liệu...',
      doneBytes: 0,
      totalBytes: 0,
      doneBlobs: 0,
      totalBlobs: 0,
    });

    // 1. Snapshot database records inside a single readonly transaction
    let rawItems: Item[] = [];
    let tags: Tag[] = [];
    let collections: Collection[] = [];

    await db.transaction('r', [db.items, db.tags, db.collections], async () => {
      tags = await db.tags.toArray();
      collections = await db.collections.toArray();
      rawItems = await db.items.toArray();
    });

    if (signal?.aborted) {
      throw new BackupError('ABORTED');
    }

    // 2. Count statistics & omit normalizedTitle from items
    const byType: Record<ItemType, number> = { note: 0, file: 0, link: 0 };
    const byStatus: Record<ItemStatus, number> = { saved: 0, inbox: 0 };
    const ndjsonLines: string[] = [];

    // Collect binary file references
    const blobMap = new Map<string, { role: 'source' | 'thumbnail'; declaredSize: number }>();

    for (const item of rawItems) {
      byType[item.type] = (byType[item.type] || 0) + 1;
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;

      // Clone and strip derived normalizedTitle
      const { normalizedTitle, ...itemWithoutNormalized } = item;
      ndjsonLines.push(JSON.stringify(itemWithoutNormalized));

      if (includeFiles && item.type === 'file') {
        const fileItem = item as FileItem;
        if (fileItem.opfsPath) {
          blobMap.set(fileItem.opfsPath, {
            role: 'source',
            declaredSize: fileItem.fileSizeBytes || 0,
          });
        }
        if (fileItem.thumbnailBlobUrl) {
          blobMap.set(fileItem.thumbnailBlobUrl, {
            role: 'thumbnail',
            declaredSize: 0,
          });
        }
        if (fileItem.files && fileItem.files.length > 0) {
          for (const f of fileItem.files) {
            if (f.opfsPath) {
              blobMap.set(f.opfsPath, {
                role: f.isThumbnail ? 'thumbnail' : 'source',
                declaredSize: f.fileSizeBytes || 0,
              });
            }
          }
        }
      }
    }

    const tagsJson = JSON.stringify(tags);
    const collectionsJson = JSON.stringify(collections);
    const itemsNdjson = ndjsonLines.join('\n');

    let declaredBlobBytes = 0;
    for (const b of blobMap.values()) {
      declaredBlobBytes += b.declaredSize;
    }

    const metadataTextLength =
      tagsJson.length + collectionsJson.length + itemsNdjson.length;

    if (metadataTextLength > MAX_METADATA_BYTES) {
      throw new BackupError('METADATA_TOO_LARGE');
    }

    // 3. Prepare Manifest
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      minReaderVersion: BACKUP_MIN_READER_VERSION,
      app: {
        name: APP_NAME,
        build: APP_BUILD,
        dbSchemaVersion: DB_SCHEMA_VERSION,
      },
      createdAt: startTime,
      options: {
        includeFiles,
      },
      counts: {
        items: rawItems.length,
        byType,
        byStatus,
        tags: tags.length,
        collections: collections.length,
        blobs: blobMap.size,
      },
      sizes: {
        metadataBytes: metadataTextLength,
        declaredBlobBytes,
      },
    };

    const manifestJson = JSON.stringify(manifest, null, 2);

    // 4. Initialize Container Writer and write in strict order
    const writer = new BackupContainerWriter(writableStream);
    const totalBlobs = blobMap.size;
    let doneBlobs = 0;
    let doneBytes = 0;
    const missingBlobs: string[] = [];
    const trailerBlobs: BackupTrailerBlob[] = [];

    try {
      onProgress?.({
        phase: 'pack',
        message: 'Đang đóng gói dữ liệu ghi chú...',
        doneBytes,
        totalBytes: metadataTextLength + declaredBlobBytes,
        doneBlobs: 0,
        totalBlobs,
      });

      // 4.1 manifest.json (DEFLATE)
      await writer.addDeflateEntry(ENTRY_NAMES.MANIFEST, manifestJson);

      // 4.2 tags.json (DEFLATE)
      await writer.addDeflateEntry(ENTRY_NAMES.TAGS, tagsJson);

      // 4.3 collections.json (DEFLATE)
      await writer.addDeflateEntry(ENTRY_NAMES.COLLECTIONS, collectionsJson);

      // 4.4 items.ndjson (DEFLATE)
      await writer.addDeflateEntry(ENTRY_NAMES.ITEMS, itemsNdjson);

      doneBytes += metadataTextLength;

      // 4.5 Blobs (STORE)
      if (includeFiles && blobMap.size > 0) {
        for (const [path, info] of blobMap.entries()) {
          if (signal?.aborted) {
            throw new BackupError('ABORTED');
          }

          onProgress?.({
            phase: 'pack',
            message: `Đang sao lưu tệp (${doneBlobs + 1}/${totalBlobs})...`,
            doneBytes,
            totalBytes: metadataTextLength + declaredBlobBytes,
            doneBlobs,
            totalBlobs,
          });

          let fileBlob: Blob | File | null = null;
          try {
            fileBlob = await fileStorage.readFile(path);
          } catch (readErr) {
            console.warn(`[BackupExporter] Could not read blob "${path}":`, readErr);
          }

          if (!fileBlob) {
            missingBlobs.push(path);
            trailerBlobs.push({
              path,
              role: info.role,
              size: 0,
              status: 'missing',
            });
          } else {
            const entryPath = `${ENTRY_NAMES.BLOBS_PREFIX}${encodeURIComponent(path)}`;
            const bytesWritten = await writer.addStoredBlob(
              entryPath,
              fileBlob,
              signal,
              (chunkSize) => {
                doneBytes += chunkSize;
              }
            );

            trailerBlobs.push({
              path,
              role: info.role,
              size: bytesWritten,
              status: 'ok',
            });
          }

          doneBlobs++;
        }
      }

      // 4.6 trailer.json (DEFLATE)
      onProgress?.({
        phase: 'finalize',
        message: 'Đang hoàn tất tệp sao lưu...',
        doneBytes,
        totalBytes: metadataTextLength + declaredBlobBytes,
        doneBlobs,
        totalBlobs,
      });

      const trailer: BackupTrailer = {
        complete: true,
        completedAt: Date.now(),
        blobs: trailerBlobs,
      };

      await writer.addDeflateEntry(ENTRY_NAMES.TRAILER, JSON.stringify(trailer, null, 2));

      // Close ZIP stream
      const output = await writer.close();
      const durationMs = Date.now() - startTime;
      const fileName = generateBackupFilename();

      // Record last export time
      recordLastExport();

      return {
        fileName,
        sizeBytes: output.sizeBytes,
        counts: {
          items: rawItems.length,
          tags: tags.length,
          collections: collections.length,
          blobs: doneBlobs - missingBlobs.length,
        },
        missingBlobs,
        durationMs,
        delivery: writableStream ? 'saved-to-disk' : 'ready-for-download',
        blob: output.blob,
      };
    } catch (err) {
      writer.abort();
      throw err;
    }
  }
}

export const backupExporter = new BackupExporter();
