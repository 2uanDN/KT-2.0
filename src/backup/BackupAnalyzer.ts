import { db } from '../db/database';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  DB_SCHEMA_VERSION,
  ENTRY_NAMES,
  EXPECTED_ENTRY_ORDER,
} from './constants';
import { BackupError } from './errors';
import { BackupContainerReader } from './container';
import { remapTagsAndCollections, sanitizeItem } from './sanitize';
import type { AnalyzeResult, BackupManifest } from './types';
import type { Item } from '../types/item';
import type { Tag } from '../types/tag';
import type { Collection } from '../types/collection';

export class BackupAnalyzer {
  async analyze(file: File, signal?: AbortSignal): Promise<AnalyzeResult> {
    if (signal?.aborted) {
      throw new BackupError('ABORTED');
    }

    // 1. Read metadata stream (up to and including items.ndjson)
    const header = await BackupContainerReader.readMetadataEntries(file, signal);

    if (signal?.aborted) {
      throw new BackupError('ABORTED');
    }

    // 2. Validate entry order
    const actualPrefix = header.entryOrder.slice(0, EXPECTED_ENTRY_ORDER.length);
    for (let i = 0; i < EXPECTED_ENTRY_ORDER.length; i++) {
      if (actualPrefix[i] !== EXPECTED_ENTRY_ORDER[i]) {
        throw new BackupError('ENTRY_ORDER_INVALID', {
          expected: EXPECTED_ENTRY_ORDER,
          actual: header.entryOrder,
        });
      }
    }

    // 3. Parse and validate manifest
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(header.manifestRaw);
    } catch (parseErr) {
      throw new BackupError('ARCHIVE_CORRUPT', parseErr);
    }

    if (manifest.format !== BACKUP_FORMAT) {
      throw new BackupError('NOT_A_BACKUP');
    }

    if (
      manifest.formatVersion > BACKUP_FORMAT_VERSION ||
      manifest.minReaderVersion > BACKUP_FORMAT_VERSION
    ) {
      throw new BackupError('UNSUPPORTED_FORMAT_VERSION');
    }

    const warnings: string[] = [];

    if (manifest.app && manifest.app.dbSchemaVersion > DB_SCHEMA_VERSION) {
      warnings.push(
        `Bản sao lưu đến từ phiên bản lược đồ cơ sở dữ liệu mới hơn (v${manifest.app.dbSchemaVersion} > v${DB_SCHEMA_VERSION}). Các trường dữ liệu mở rộng sẽ được giữ nguyên.`
      );
    }

    // 4. Parse tags and collections
    let rawTags: Tag[] = [];
    let rawCols: Collection[] = [];
    try {
      rawTags = JSON.parse(header.tagsRaw || '[]');
      rawCols = JSON.parse(header.collectionsRaw || '[]');
    } catch (parseErr) {
      throw new BackupError('ARCHIVE_CORRUPT', parseErr);
    }

    // 5. Query local database state
    const localTags = await db.tags.toArray();
    const localCols = await db.collections.toArray();
    const localItems = await db.items.toArray();

    const localItemMap = new Map<string, Item>();
    for (const item of localItems) {
      localItemMap.set(item.id, item);
    }

    // 6. Remap tags and collections against local database
    const remap = remapTagsAndCollections(rawTags, rawCols, localTags, localCols);

    // 7. Parse and sanitize NDJSON items line by line
    const rawLines = header.itemsNdjsonRaw.split(/\r?\n/);
    const parsedItems: Item[] = [];
    let droppedInvalidCount = 0;
    let newItemsCount = 0;
    let existingSameIdCount = 0;
    let backupNewerCount = 0;
    let localNewerCount = 0;

    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
      const line = rawLines[lineIndex].trim();
      if (!line) continue;

      let rawObj: any;
      try {
        rawObj = JSON.parse(line);
      } catch {
        droppedInvalidCount++;
        warnings.push(`Dòng ${lineIndex + 1} trong tệp ghi chú bị lỗi định dạng JSON và đã bị bỏ qua.`);
        continue;
      }

      const { item, warning, error } = sanitizeItem(
        rawObj,
        remap.tagIdMap,
        remap.colIdMap,
        remap.validTagIds,
        remap.validColIds
      );

      if (error || !item) {
        droppedInvalidCount++;
        warnings.push(`Mục tại dòng ${lineIndex + 1}: ${error || 'Không hợp lệ'}`);
        continue;
      }

      if (warning) {
        warnings.push(warning);
      }

      parsedItems.push(item);

      const localItem = localItemMap.get(item.id);
      if (localItem) {
        existingSameIdCount++;
        const localTime = (localItem.updatedAt ?? localItem.savedAt ?? localItem.createdAt) || 0;
        const backupTime = (item.updatedAt ?? item.savedAt ?? item.createdAt) || 0;
        if (backupTime > localTime) {
          backupNewerCount++;
        } else {
          localNewerCount++;
        }
      } else {
        newItemsCount++;
      }
    }

    const canReplace = manifest.options.includeFiles !== false;

    return {
      manifest,
      parsedTagsCount: rawTags.length,
      parsedCollectionsCount: rawCols.length,
      parsedItemsCount: parsedItems.length,
      parsedBlobsCount: manifest.counts.blobs || 0,
      newItemsCount,
      existingSameIdCount,
      backupNewerCount,
      localNewerCount,
      tagsToRemapCount: remap.tagsMergedCount,
      collectionsToRemapCount: remap.colsMergedCount,
      droppedInvalidCount,
      warnings,
      canReplace,
      parsedItems,
      parsedTags: remap.tagsToCreate,
      parsedCollections: remap.colsToCreate,
    };
  }
}

export const backupAnalyzer = new BackupAnalyzer();
