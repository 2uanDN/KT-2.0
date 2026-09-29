import { db } from '../db/database';
import { fileService } from './FileService';

export interface PendingFileTracker {
  markInFlight(path: string): void;
  unmarkInFlight(paths: string[]): void;
  isInFlight(path: string): boolean;
  record(path: string): Promise<void>;
  clear(paths: string[]): Promise<void>;
  rollback(paths: string[]): Promise<void>;
}

interface StoredPendingCleanup {
  id: string;
  createdAt: number;
}

const STORAGE_KEY = 'kt_pending_opfs_cleanups';

class DefaultPendingFileTracker implements PendingFileTracker {
  /**
   * Tracks OPFS file paths currently being written or processed in this tab/process.
   * Prevents concurrent background cleanup from deleting active in-flight files.
   */
  private activeInFlightPaths = new Set<string>();

  markInFlight(path: string): void {
    if (path) {
      this.activeInFlightPaths.add(path);
    }
  }

  unmarkInFlight(paths: string[]): void {
    for (const p of paths) {
      this.activeInFlightPaths.delete(p);
    }
  }

  isInFlight(path: string): boolean {
    return this.activeInFlightPaths.has(path);
  }

  private parseStoredCleanups(raw: string | null): StoredPendingCleanup[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const result: StoredPendingCleanup[] = [];
      for (const item of parsed) {
        if (typeof item === 'string' && item.trim()) {
          result.push({ id: item.trim(), createdAt: Date.now() });
        } else if (item && typeof item === 'object' && typeof item.id === 'string') {
          result.push({
            id: item.id.trim(),
            createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          });
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Tracks an in-flight OPFS path in both localStorage and IndexedDB before DB record commit.
   * Protects against storage leaks when browser crashes or DB write fails.
   */
  async record(opfsPath: string): Promise<void> {
    if (!opfsPath) return;

    // 1. Mirror synchronously to localStorage for crash resilience even if IDB is quota-exhausted
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        const list = this.parseStoredCleanups(raw);
        if (!list.some((e) => e.id === opfsPath)) {
          list.push({ id: opfsPath, createdAt: Date.now() });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        }
      }
    } catch {
      // Non-fatal if localStorage is restricted
    }

    // 2. Persist to Dexie pendingCleanups table
    try {
      await db.pendingCleanups.put({ id: opfsPath, createdAt: Date.now() });
    } catch (err) {
      console.warn('Failed to record pending cleanup in IndexedDB:', opfsPath, err);
    }
  }

  /**
   * Untracks committed OPFS paths from pending cleanup stores once DB write succeeds.
   */
  async clear(opfsPaths: string[]): Promise<void> {
    if (!opfsPaths || opfsPaths.length === 0) return;

    // 1. Clear from localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const toRemove = new Set(opfsPaths);
          const list = this.parseStoredCleanups(raw);
          const remaining = list.filter((p) => !toRemove.has(p.id));
          if (remaining.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // 2. Clear from Dexie
    try {
      await db.pendingCleanups.bulkDelete(opfsPaths);
    } catch (err) {
      console.warn('Failed to clear pending cleanups from IndexedDB:', err);
    }

    // 3. Remove from in-flight memory set
    this.unmarkInFlight(opfsPaths);
  }

  /**
   * Immediate rollback of newly created OPFS files on DB write failure.
   */
  async rollback(opfsPaths: string[]): Promise<void> {
    for (const path of opfsPaths) {
      try {
        await fileService.deleteFile(path);
      } catch (cleanupErr) {
        console.warn('Failed to clean up newly created OPFS file after failure:', path, cleanupErr);
      }
    }
    await this.clear(opfsPaths);
  }
}

export const pendingFileTracker: PendingFileTracker = new DefaultPendingFileTracker();
