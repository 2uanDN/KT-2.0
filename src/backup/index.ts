import { db } from '../db/database';
import { backupExporter } from './BackupExporter';
import { backupAnalyzer } from './BackupAnalyzer';
import { backupImporter } from './BackupImporter';
import type {
  ExportOptions,
  ExportResult,
  AnalyzeResult,
  ImportOptions,
  ImportReport,
} from './types';
import type { FileItem } from '../types/item';

export interface StorageEstimateInfo {
  usageBytes: number;
  quotaBytes: number;
  isPersisted: boolean;
}

export interface BackupEstimate {
  items: number;
  files: number;
  approxBytes: number;
}

class BackupService {
  /**
   * Calculates rough estimate of current database size and file count.
   */
  async estimate(): Promise<BackupEstimate> {
    const items = await db.items.count();
    const fileItems = (await db.items.where('type').equals('file').toArray()) as FileItem[];

    let approxBytes = items * 600; // Average JSON overhead per item
    let files = 0;

    for (const item of fileItems) {
      if (item.files && item.files.length > 0) {
        for (const f of item.files) {
          files++;
          approxBytes += f.fileSizeBytes || 0;
        }
      } else {
        files++;
        approxBytes += item.fileSizeBytes || 0;
      }
    }

    return {
      items,
      files,
      approxBytes,
    };
  }

  async exportBackup(options: ExportOptions): Promise<ExportResult> {
    return backupExporter.exportBackup(options);
  }

  async analyze(file: File, signal?: AbortSignal): Promise<AnalyzeResult> {
    return backupAnalyzer.analyze(file, signal);
  }

  async importBackup(
    file: File,
    analysis: AnalyzeResult,
    options: ImportOptions
  ): Promise<ImportReport> {
    return backupImporter.importBackup(file, analysis, options);
  }

  async getStorageEstimate(): Promise<StorageEstimateInfo> {
    let usageBytes = 0;
    let quotaBytes = 0;
    let isPersisted = false;

    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (typeof navigator.storage.estimate === 'function') {
        try {
          const est = await navigator.storage.estimate();
          usageBytes = est.usage || 0;
          quotaBytes = est.quota || 0;
        } catch {
          // Non-fatal
        }
      }

      if (typeof navigator.storage.persisted === 'function') {
        try {
          isPersisted = await navigator.storage.persisted();
        } catch {
          // Non-fatal
        }
      }
    }

    return {
      usageBytes,
      quotaBytes,
      isPersisted,
    };
  }

  async requestPersistentStorage(): Promise<boolean> {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      try {
        return await navigator.storage.persist();
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const backupService = new BackupService();

export * from './constants';
export * from './types';
export * from './errors';
export * from './backupMeta';
