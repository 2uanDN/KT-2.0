import { db } from '../db/database';

export interface BackupMeta {
  lastExportAt: number | null;
  lastImportAt: number | null;
}

const BACKUP_META_STORAGE_KEY = 'kt_backup_meta_v1';

export function getBackupMeta(): BackupMeta {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(BACKUP_META_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          lastExportAt: typeof parsed.lastExportAt === 'number' ? parsed.lastExportAt : null,
          lastImportAt: typeof parsed.lastImportAt === 'number' ? parsed.lastImportAt : null,
        };
      }
    }
  } catch {
    // Non-fatal if localStorage is restricted
  }
  return {
    lastExportAt: null,
    lastImportAt: null,
  };
}

export function saveBackupMeta(updates: Partial<BackupMeta>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const current = getBackupMeta();
      const updated: BackupMeta = {
        ...current,
        ...updates,
      };
      localStorage.setItem(BACKUP_META_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Non-fatal
  }
}

export function recordLastExport(timestamp = Date.now()): void {
  saveBackupMeta({ lastExportAt: timestamp });
}

export function recordLastImport(timestamp = Date.now()): void {
  saveBackupMeta({ lastImportAt: timestamp });
}

/**
 * Counts items created or modified after `lastExportAt`.
 * Uses Dexie indexed query on `updatedAt`.
 */
export async function getUnbackedChangesCount(lastExportAt: number | null): Promise<number> {
  try {
    if (!lastExportAt) {
      return await db.items.count();
    }
    return await db.items.where('updatedAt').above(lastExportAt).count();
  } catch (err) {
    console.warn('Failed to query unbacked changes count:', err);
    return 0;
  }
}
