import { db } from '../db/database';
import { fileService } from './FileService';
import { searchService } from './SearchService';
import { linkMetaService } from './LinkMetaService';
import { thumbnailService } from './ThumbnailService';
import { pendingFileTracker } from './PendingFileTracker';
import { toastStore } from '../store/toastStore';
import { normalizeTitle } from '../utils/vietnamese';
import { withCrossTabLock } from '../utils/crossTabLock';
import type { Item, NoteItem, FileItem, LinkItem, CreateItemDraft, StoredFile, QueuedFileDraft } from '../types/item';

const PENDING_FILE_GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 minutes grace period for in-flight creates

interface StoredPendingCleanup {
  id: string;
  createdAt: number;
}

class ItemService {
  /**
   * Tracks OPFS file paths currently being written or processed in this tab/process.
   * Delegates to pendingFileTracker.
   */
  private markInFlight(path: string): void {
    pendingFileTracker.markInFlight(path);
  }

  private unmarkInFlight(paths: string[]): void {
    pendingFileTracker.unmarkInFlight(paths);
  }

  private isInFlight(path: string): boolean {
    return pendingFileTracker.isInFlight(path);
  }

  private buildItemFromDraft(draft: CreateItemDraft, keepLong: boolean): Item {
    const id = crypto.randomUUID();
    const now = Date.now();
    const status: 'saved' | 'inbox' = keepLong ? 'saved' : 'inbox';
    const savedAt = keepLong ? now : null;

    const base = {
      id,
      status,
      isPinned: draft.isPinned ?? false,
      tags: Array.from(new Set(draft.tags ?? [])),
      collections: Array.from(new Set(draft.collections ?? [])),
      createdAt: now,
      savedAt,
      lastOpenedAt: null,
      updatedAt: now,
    };

    if (draft.type === 'note') {
      const body = draft.body ?? '';
      let title = draft.title?.trim();
      if (!title) {
        const firstLine = body.split('\n')[0]?.replace(/^[#*>\s_\-]+/, '').trim();
        title = firstLine ? firstLine.slice(0, 80) : 'Ghi chú không tiêu đề';
      }
      const noteItem: NoteItem = {
        ...base,
        type: 'note',
        title,
        normalizedTitle: normalizeTitle(title),
        body,
      };
      return noteItem;
    }

    if (draft.type === 'file') {
      const displayName = draft.displayName?.trim() || draft.title?.trim() || 'Tệp không tên';
      const fileItem: FileItem = {
        ...base,
        type: 'file',
        title: displayName,
        normalizedTitle: normalizeTitle(displayName),
        displayName,
        fileType: draft.fileType ?? 'pdf',
        originalFilename: draft.file?.name ?? draft.fileQueue?.[0]?.originalFilename ?? 'file.bin',
        caption: draft.caption?.trim() ?? '',
        fileSizeBytes: draft.file?.size ?? draft.fileQueue?.reduce((acc, f) => acc + f.fileSizeBytes, 0) ?? 0,
        opfsPath: '', // to be filled after storing
        mimeType: draft.file?.type ?? draft.fileQueue?.[0]?.mimeType ?? 'application/octet-stream',
        files: [],
      };
      return fileItem;
    }

    // Link Item
    const rawUrl = draft.url?.trim() ?? '';
    const domain = linkMetaService.parseDomain(rawUrl);
    const title = draft.title?.trim() || draft.fetchedTitle?.trim() || domain || 'Liên kết web';
    const fetchedTitle = draft.fetchedTitle?.trim() || null;
    const previewImageUrl = draft.previewImageUrl?.trim() || null;

    // Reflect whether remote metadata was actually fetched:
    // When created locally without fetching, status is 'idle'.
    // If fetchedTitle/previewImageUrl are present, status is 'success'.
    const fetchStatus: LinkItem['fetchStatus'] =
      draft.fetchStatus ?? (fetchedTitle || previewImageUrl ? 'success' : 'idle');

    const linkItem: LinkItem = {
      ...base,
      type: 'link',
      title,
      normalizedTitle: normalizeTitle(title),
      url: linkMetaService.normalizeUrl(rawUrl),
      domain,
      reason: draft.reason?.trim() ?? '',
      fetchedTitle,
      previewImageUrl,
      fetchStatus,
    };
    return linkItem;
  }

  async checkDuplicateUrl(url: string, excludeItemId?: string): Promise<LinkItem | null> {
    const trimmed = url.trim();
    if (!trimmed) return null;

    const normalized = linkMetaService.normalizeUrl(trimmed);
    const altNormalized = normalized.endsWith('/')
      ? normalized.slice(0, -1)
      : normalized + '/';

    const urlsToCheck = new Set<string>();
    urlsToCheck.add(trimmed);
    urlsToCheck.add(normalized);
    urlsToCheck.add(altNormalized);

    if (normalized.startsWith('https://')) {
      const httpVariant = 'http://' + normalized.slice(8);
      urlsToCheck.add(httpVariant);
      urlsToCheck.add(httpVariant.endsWith('/') ? httpVariant.slice(0, -1) : httpVariant + '/');
    } else if (normalized.startsWith('http://')) {
      const httpsVariant = 'https://' + normalized.slice(7);
      urlsToCheck.add(httpsVariant);
      urlsToCheck.add(httpsVariant.endsWith('/') ? httpsVariant.slice(0, -1) : httpsVariant + '/');
    }

    // Direct indexed lookup: queries only matching keys using IndexedDB 'url' index,
    // avoiding O(N) full table scan and object allocations per keystroke.
    const candidates = (await db.items
      .where('url')
      .anyOf(Array.from(urlsToCheck))
      .toArray()) as LinkItem[];

    for (const item of candidates) {
      if (item.id !== excludeItemId && item.type === 'link') {
        return item;
      }
    }

    return null;
  }

  /**
   * Parses pending cleanup entries from localStorage.
   * Handles both new { id, createdAt } format and legacy string format.
   */
  private parseStoredCleanups(raw: string | null): StoredPendingCleanup[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const result: StoredPendingCleanup[] = [];
      for (const item of parsed) {
        if (typeof item === 'string' && item.trim()) {
          // Legacy string entry: default createdAt to now to grant grace period
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

  private async recordPendingOpfsPath(opfsPath: string): Promise<void> {
    await pendingFileTracker.record(opfsPath);
  }

  private async clearPendingOpfsPaths(opfsPaths: string[]): Promise<void> {
    await pendingFileTracker.clear(opfsPaths);
  }

  private async rollbackPendingOpfsFiles(opfsPaths: string[]): Promise<void> {
    await pendingFileTracker.rollback(opfsPaths);
  }

  /**
   * Point-in-time check to verify whether a given OPFS path is referenced by any item in db.items.
   * Used as a TOCTOU safety guard immediately prior to deleting a file from OPFS.
   */
  async isPathReferencedInDb(path: string): Promise<boolean> {
    if (!path) return false;
    try {
      const count = await db.items
        .where('type')
        .equals('file')
        .filter((item) => {
          const f = item as FileItem;
          if (f.opfsPath === path || f.thumbnailBlobUrl === path) return true;
          if (f.files && f.files.some((sf) => sf.opfsPath === path)) return true;
          return false;
        })
        .count();
      return count > 0;
    } catch (err) {
      console.warn('Failed to check path reference in db.items:', path, err);
      // Fail closed: err on the side of preserving the file
      return true;
    }
  }

  /**
   * Scans pending cleanup registers and purges orphaned OPFS files not referenced by any item.
   * TOCTOU-safe implementation:
   * 1. Requires cross-tab lock (`kt_cleanup_orphans_lock`).
   * 2. Skips in-flight paths actively being processed by the local tab (`activeInFlightPaths`).
   * 3. Ignores candidate entries within the grace period (`PENDING_FILE_GRACE_PERIOD_MS`).
   * 4. Point-in-time double checks `isPathReferencedInDb` immediately before deleting each file.
   * 5. Only untracks candidates that were either deleted or confirmed to be referenced in db.items.
   */
  async cleanupPendingOrphanedFiles(): Promise<number> {
    const lockRes = await withCrossTabLock(
      'kt_cleanup_orphans_lock',
      async () => {
        let cleanedCount = 0;
        const now = Date.now();
        const candidateEntries = new Map<string, number>(); // path -> createdAt

        // 1. Collect from localStorage
        try {
          if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem('kt_pending_opfs_cleanups');
            const list = this.parseStoredCleanups(raw);
            for (const item of list) {
              candidateEntries.set(item.id, item.createdAt);
            }
          }
        } catch {
          // Non-fatal
        }

        // 2. Collect from Dexie pendingCleanups
        try {
          const pendingEntries = await db.pendingCleanups.toArray();
          for (const entry of pendingEntries) {
            const existingTime = candidateEntries.get(entry.id);
            const entryTime = typeof entry.createdAt === 'number' ? entry.createdAt : now;
            candidateEntries.set(
              entry.id,
              existingTime !== undefined ? Math.min(existingTime, entryTime) : entryTime
            );
          }
        } catch (err) {
          console.warn('Failed to read pendingCleanups table:', err);
        }

        if (candidateEntries.size === 0) return 0;

        // 3. Filter candidates: exclude in-flight paths and paths within the grace period
        const eligibleCandidates: string[] = [];
        for (const [path, createdAt] of candidateEntries.entries()) {
          // Skip if in-flight in this process
          if (this.isInFlight(path)) {
            continue;
          }
          // Skip if created within grace period (active upload in this or another tab)
          if (now - createdAt < PENDING_FILE_GRACE_PERIOD_MS) {
            continue;
          }
          eligibleCandidates.push(path);
        }

        if (eligibleCandidates.length === 0) return 0;

        // 4. Collect active referenced OPFS paths from db.items
        const activePaths = new Set<string>();
        try {
          const fileItems = (await db.items.where('type').equals('file').toArray()) as FileItem[];
          for (const item of fileItems) {
            if (item.opfsPath) activePaths.add(item.opfsPath);
            if (item.thumbnailBlobUrl) activePaths.add(item.thumbnailBlobUrl);
            if (item.files) {
              for (const f of item.files) {
                if (f.opfsPath) activePaths.add(f.opfsPath);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to query active file items from db:', err);
          return 0; // Abort cleanup to avoid false-positive deletions
        }

        // 5. Evaluate eligible candidates with point-in-time TOCTOU verification
        const pathsToClearFromPending: string[] = [];

        for (const candidate of eligibleCandidates) {
          // If already in active paths set, it's safely committed
          if (activePaths.has(candidate)) {
            pathsToClearFromPending.push(candidate);
            continue;
          }

          // TOCTOU check 1: In-flight local guard
          if (this.isInFlight(candidate)) {
            continue; // Keep in pendingCleanups for future re-evaluation
          }

          // TOCTOU check 2: Point-in-time DB check right before deletion
          const isReferenced = await this.isPathReferencedInDb(candidate);
          if (isReferenced) {
            // Item was committed during cleanup; do NOT delete
            pathsToClearFromPending.push(candidate);
            continue;
          }

          // File is genuinely orphaned: delete from OPFS
          try {
            await fileService.deleteFile(candidate);
            cleanedCount++;
            pathsToClearFromPending.push(candidate);
          } catch (err) {
            console.warn('Failed to purge orphaned OPFS file:', candidate, err);
          }
        }

        // Untrack only candidates that were either deleted or confirmed referenced
        if (pathsToClearFromPending.length > 0) {
          await this.clearPendingOpfsPaths(pathsToClearFromPending);
        }

        return cleanedCount;
      },
      { ifAvailable: true }
    );

    return lockRes.acquired && typeof lockRes.result === 'number' ? lockRes.result : 0;
  }

  async createItem(draft: CreateItemDraft, keepLong: boolean): Promise<Item> {
    const item = this.buildItemFromDraft(draft, keepLong);
    const newlyCreatedOpfsPaths: string[] = [];

    try {
      if (item.type === 'file') {
        const fileItem = item as FileItem;
        const storedFiles: StoredFile[] = [];

        // If draft has fileQueue (multi-file list)
        if (draft.fileQueue && draft.fileQueue.length > 0) {
          let totalSize = 0;
          let chosenThumbnailPath: string | undefined = undefined;
          let chosenThumbnailId: string | undefined = undefined;

          // Ensure default thumbnail is the first image file if none is explicitly marked
          const hasExplicitThumbnail = draft.fileQueue.some((qf) => qf.isThumbnail);
          const firstImageIndex = draft.fileQueue.findIndex(
            (qf) => qf.isImage || fileService.isImage(qf.originalFilename, qf.mimeType)
          );

          for (let i = 0; i < draft.fileQueue.length; i++) {
            const qf = draft.fileQueue[i];
            let opfsPath = '';
            if (qf.file) {
              opfsPath = await fileService.storeFile(qf.file, qf.originalFilename);
              this.markInFlight(opfsPath);
              newlyCreatedOpfsPaths.push(opfsPath);
              await this.recordPendingOpfsPath(opfsPath);
            } else if (qf.storedFile) {
              opfsPath = qf.storedFile.opfsPath;
            }

            const isImageFile = qf.isImage || fileService.isImage(qf.originalFilename, qf.mimeType);
            const isThumb = hasExplicitThumbnail ? Boolean(qf.isThumbnail) : i === firstImageIndex;

            const storedFile: StoredFile = {
              id: qf.id || crypto.randomUUID(),
              originalFilename: qf.originalFilename,
              fileSizeBytes: qf.fileSizeBytes,
              opfsPath,
              mimeType: qf.mimeType,
              fileType: qf.fileType,
              isThumbnail: isThumb,
            };
            storedFiles.push(storedFile);
            totalSize += qf.fileSizeBytes;

            // If this file is chosen as thumbnail
            if (isThumb && isImageFile) {
              if (qf.file) {
                const thumb = await thumbnailService.generateImageThumbnail(qf.file);
                if (thumb) {
                  chosenThumbnailPath = thumb;
                  chosenThumbnailId = storedFile.id;
                  this.markInFlight(thumb);
                  newlyCreatedOpfsPaths.push(thumb);
                  await this.recordPendingOpfsPath(thumb);
                }
              } else if (opfsPath) {
                const blob = await fileService.readFile(opfsPath);
                if (blob) {
                  const thumb = await thumbnailService.generateImageThumbnail(blob);
                  if (thumb) {
                    chosenThumbnailPath = thumb;
                    chosenThumbnailId = storedFile.id;
                    this.markInFlight(thumb);
                    newlyCreatedOpfsPaths.push(thumb);
                    await this.recordPendingOpfsPath(thumb);
                  }
                }
              }
            }
          }

          fileItem.files = storedFiles;
          fileItem.fileSizeBytes = totalSize;
          if (storedFiles.length > 0) {
            fileItem.opfsPath = storedFiles[0].opfsPath;
            fileItem.originalFilename = storedFiles[0].originalFilename;
            fileItem.fileType = storedFiles[0].fileType;
            fileItem.mimeType = storedFiles[0].mimeType;
          }

          if (chosenThumbnailPath) {
            fileItem.thumbnailBlobUrl = chosenThumbnailPath;
            fileItem.thumbnailFileId = chosenThumbnailId;
          } else {
            fileItem.thumbnailBlobUrl = undefined;
            fileItem.thumbnailFileId = undefined;
          }
        } else if (draft.file) {
          // Fallback for single file
          const opfsPath = await fileService.storeFile(draft.file, draft.file.name);
          this.markInFlight(opfsPath);
          newlyCreatedOpfsPaths.push(opfsPath);
          await this.recordPendingOpfsPath(opfsPath);

          fileItem.opfsPath = opfsPath;
          fileItem.fileSizeBytes = draft.file.size;
          fileItem.originalFilename = draft.file.name;

          const isImg = fileService.isImage(draft.file.name, draft.file.type);
          const storedFile: StoredFile = {
            id: crypto.randomUUID(),
            originalFilename: draft.file.name,
            fileSizeBytes: draft.file.size,
            opfsPath,
            mimeType: draft.file.type || 'application/octet-stream',
            fileType: draft.fileType ?? (isImg ? 'image' : 'pdf'),
            isThumbnail: isImg,
          };
          fileItem.files = [storedFile];

          if (isImg) {
            const thumb = await thumbnailService.generateImageThumbnail(draft.file);
            if (thumb) {
              fileItem.thumbnailBlobUrl = thumb;
              fileItem.thumbnailFileId = storedFile.id;
              this.markInFlight(thumb);
              newlyCreatedOpfsPaths.push(thumb);
              await this.recordPendingOpfsPath(thumb);
            }
          }
        }
      }

      await db.items.add(item);

      // Untrack pending files on successful DB commit
      if (newlyCreatedOpfsPaths.length > 0) {
        await this.clearPendingOpfsPaths(newlyCreatedOpfsPaths);
      }
    } catch (error) {
      // Rollback newly created files on failure to prevent orphaned blobs
      if (newlyCreatedOpfsPaths.length > 0) {
        await this.rollbackPendingOpfsFiles(newlyCreatedOpfsPaths);
      }
      throw error;
    } finally {
      this.unmarkInFlight(newlyCreatedOpfsPaths);
    }

    await searchService.add(item);

    toastStore.show(keepLong ? 'Đã lưu vào Thư viện' : 'Đã chuyển vào Hộp chờ', {
      undoFn: async () => {
        await this.deleteItem(item.id, false);
      },
    });

    return item;
  }

  async updateFileItemWithQueue(
    id: string,
    updates: Partial<FileItem>,
    newQueue: QueuedFileDraft[]
  ): Promise<void> {
    const current = (await db.items.get(id)) as FileItem | undefined;
    if (!current || current.type !== 'file') return;

    const existingFiles = current.files || [
      {
        id: current.id,
        originalFilename: current.originalFilename,
        fileSizeBytes: current.fileSizeBytes,
        opfsPath: current.opfsPath,
        mimeType: current.mimeType,
        fileType: current.fileType,
        isThumbnail: Boolean(current.thumbnailBlobUrl),
      },
    ];

    // Identify old files to be deleted only AFTER DB update succeeds
    const retainedIds = new Set(newQueue.map((qf) => qf.id));
    const oldFilesToDelete: string[] = [];
    for (const oldFile of existingFiles) {
      if (!retainedIds.has(oldFile.id) && oldFile.opfsPath) {
        oldFilesToDelete.push(oldFile.opfsPath);
      }
    }

    // Track newly written files in OPFS so we can roll them back if DB write fails
    const newlyCreatedOpfsPaths: string[] = [];

    // Process new queue
    const updatedStoredFiles: StoredFile[] = [];
    let totalSize = 0;
    let chosenThumbnailPath: string | undefined = undefined;
    let chosenThumbnailId: string | undefined = undefined;

    const hasExplicitThumbnail = newQueue.some((qf) => qf.isThumbnail);
    const firstImageIndex = newQueue.findIndex(
      (qf) => qf.isImage || fileService.isImage(qf.originalFilename, qf.mimeType)
    );

    try {
      for (let i = 0; i < newQueue.length; i++) {
        const qf = newQueue[i];
        let opfsPath = '';
        if (qf.file) {
          // Newly added file
          opfsPath = await fileService.storeFile(qf.file, qf.originalFilename);
          this.markInFlight(opfsPath);
          newlyCreatedOpfsPaths.push(opfsPath);
          await this.recordPendingOpfsPath(opfsPath);
        } else if (qf.storedFile) {
          // Existing file
          opfsPath = qf.storedFile.opfsPath;
        } else {
          const existing = existingFiles.find((f) => f.id === qf.id);
          opfsPath = existing?.opfsPath || '';
        }

        const isImageFile = qf.isImage || fileService.isImage(qf.originalFilename, qf.mimeType);
        const isThumb = hasExplicitThumbnail ? Boolean(qf.isThumbnail) : i === firstImageIndex;

        const stored: StoredFile = {
          id: qf.id,
          originalFilename: qf.originalFilename,
          fileSizeBytes: qf.fileSizeBytes,
          opfsPath,
          mimeType: qf.mimeType,
          fileType: qf.fileType,
          isThumbnail: isThumb,
        };
        updatedStoredFiles.push(stored);
        totalSize += qf.fileSizeBytes;

        if (isThumb && isImageFile) {
          chosenThumbnailId = stored.id;
          if (qf.file) {
            const thumb = await thumbnailService.generateImageThumbnail(qf.file);
            if (thumb) {
              chosenThumbnailPath = thumb;
              this.markInFlight(thumb);
              newlyCreatedOpfsPaths.push(thumb);
              await this.recordPendingOpfsPath(thumb);
            }
          } else if (current.thumbnailFileId === stored.id && current.thumbnailBlobUrl) {
            // Keep existing thumbnail
            chosenThumbnailPath = current.thumbnailBlobUrl;
          } else if (stored.opfsPath) {
            // Generate thumbnail from existing stored file
            const blob = await fileService.readFile(stored.opfsPath);
            if (blob) {
              const thumb = await thumbnailService.generateImageThumbnail(blob);
              if (thumb) {
                chosenThumbnailPath = thumb;
                this.markInFlight(thumb);
                newlyCreatedOpfsPaths.push(thumb);
                await this.recordPendingOpfsPath(thumb);
              }
            }
          }
        }
      }

      const patch: Partial<FileItem> = {
        ...updates,
        updatedAt: Date.now(),
        files: updatedStoredFiles,
        fileSizeBytes: totalSize,
        thumbnailBlobUrl: chosenThumbnailPath || undefined,
        thumbnailFileId: chosenThumbnailId || undefined,
      };

      const titleCandidate =
        patch.title?.trim() ||
        patch.displayName?.trim() ||
        current.title?.trim() ||
        current.displayName?.trim() ||
        current.originalFilename?.trim() ||
        'Tệp không tên';
      patch.title = titleCandidate;
      if (patch.displayName !== undefined) {
        patch.displayName = titleCandidate;
      }
      patch.normalizedTitle = normalizeTitle(titleCandidate);

      if (updatedStoredFiles.length > 0) {
        patch.opfsPath = updatedStoredFiles[0].opfsPath;
        patch.originalFilename = updatedStoredFiles[0].originalFilename;
        patch.fileType = updatedStoredFiles[0].fileType;
        patch.mimeType = updatedStoredFiles[0].mimeType;
      }

      // COMMIT TO DATABASE FIRST: Only proceed with cleanup if DB update succeeds
      await db.items.update(id, patch as Partial<Item>);

      // Untrack pending newly created files once DB update succeeds
      if (newlyCreatedOpfsPaths.length > 0) {
        await this.clearPendingOpfsPaths(newlyCreatedOpfsPaths);
      }

      const updated = await db.items.get(id);
      if (updated) {
        await searchService.update(updated);
      }
    } catch (error) {
      // Rollback newly created files on failure to prevent orphaned blobs
      if (newlyCreatedOpfsPaths.length > 0) {
        await this.rollbackPendingOpfsFiles(newlyCreatedOpfsPaths);
      }
      throw error;
    } finally {
      this.unmarkInFlight(newlyCreatedOpfsPaths);
    }

    // ONLY AFTER SUCCESSFUL DB COMMIT: delete old files and replaced thumbnails
    const retainedOpfsPaths = new Set(
      updatedStoredFiles.map((f) => f.opfsPath).filter(Boolean)
    );

    for (const oldPath of oldFilesToDelete) {
      if (!retainedOpfsPaths.has(oldPath)) {
        try {
          await fileService.deleteFile(oldPath);
        } catch (delErr) {
          console.warn('Failed to delete removed file from OPFS:', oldPath, delErr);
        }
      }
    }

    // Clean up old thumbnail if it was replaced or removed, and not retained as a file
    if (
      current.thumbnailBlobUrl &&
      (!chosenThumbnailPath || chosenThumbnailPath !== current.thumbnailBlobUrl) &&
      !retainedOpfsPaths.has(current.thumbnailBlobUrl)
    ) {
      try {
        await fileService.deleteFile(current.thumbnailBlobUrl);
      } catch (delErr) {
        console.warn('Failed to delete replaced thumbnail from OPFS:', current.thumbnailBlobUrl, delErr);
      }
    }
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<void> {
    const current = await db.items.get(id);
    if (!current) return;

    const patch: Partial<Item> = { ...updates, updatedAt: Date.now() };
    if (patch.tags) {
      patch.tags = Array.from(new Set(patch.tags));
    }
    if (patch.collections) {
      patch.collections = Array.from(new Set(patch.collections));
    }

    // Auto title fix for note if body is updated and title is not explicitly provided or empty
    if (current.type === 'note' && (patch as Partial<NoteItem>).body !== undefined && !patch.title?.trim()) {
      const body = (patch as Partial<NoteItem>).body || '';
      const firstLine = body.split('\n')[0]?.replace(/^[#*>\s_\-]+/, '').trim();
      patch.title = firstLine ? firstLine.slice(0, 80) : 'Ghi chú không tiêu đề';
    }

    // Domain normalization & Title validation:
    // If title is being updated (or was derived), ensure it is trimmed, non-empty, and normalized.
    if (patch.title !== undefined) {
      const trimmedTitle = patch.title.trim();
      if (trimmedTitle.length > 0) {
        patch.title = trimmedTitle;
        patch.normalizedTitle = normalizeTitle(trimmedTitle);
      } else {
        // Fallback for empty or whitespace-only title to prevent silent data corruption
        let fallbackTitle = '';
        if (current.type === 'note') {
          const body = (patch as Partial<NoteItem>).body ?? current.body ?? '';
          const firstLine = body.split('\n')[0]?.replace(/^[#*>\s_\-]+/, '').trim();
          fallbackTitle = firstLine ? firstLine.slice(0, 80) : 'Ghi chú không tiêu đề';
        } else if (current.type === 'file') {
          fallbackTitle =
            (patch as Partial<FileItem>).displayName?.trim() ||
            current.displayName?.trim() ||
            current.originalFilename?.trim() ||
            'Tệp không tên';
        } else if (current.type === 'link') {
          fallbackTitle =
            (patch as Partial<LinkItem>).fetchedTitle?.trim() ||
            current.fetchedTitle?.trim() ||
            current.domain?.trim() ||
            'Liên kết web';
        } else {
          fallbackTitle = (current as Item).title?.trim() || 'Mục không tên';
        }
        patch.title = fallbackTitle;
        patch.normalizedTitle = normalizeTitle(fallbackTitle);
      }
    }

    await db.items.update(id, patch);

    const updated = await db.items.get(id);
    if (updated) {
      await searchService.update(updated);
    }
  }

  async moveItem(id: string, to: 'saved' | 'inbox'): Promise<void> {
    const current = await db.items.get(id);
    if (!current) return;

    const now = Date.now();
    const patch =
      to === 'saved'
        ? { status: 'saved' as const, savedAt: now, updatedAt: now }
        : { status: 'inbox' as const, savedAt: null, updatedAt: now };

    await db.items.update(id, patch);
    const updated = await db.items.get(id);
    if (updated) {
      await searchService.update(updated);
    }

    const label = to === 'saved' ? 'Đã chuyển vào Thư viện' : 'Đã chuyển về Hộp chờ';
    toastStore.show(label, {
      undoFn: async () => {
        await this.moveItem(id, to === 'saved' ? 'inbox' : 'saved');
      },
    });
  }

  async togglePin(id: string): Promise<void> {
    const item = await db.items.get(id);
    if (!item) return;

    const newPinned = !item.isPinned;
    await db.items.update(id, { isPinned: newPinned });
    const updated = await db.items.get(id);
    if (updated) {
      await searchService.update(updated);
    }

    toastStore.show(newPinned ? 'Đã ghim mục' : 'Đã bỏ ghim', {
      undoFn: async () => {
        await this.togglePin(id);
      },
    });
  }

  async touchOpened(id: string): Promise<void> {
    await this.markAsOpened(id);
  }

  async markAsOpened(id: string): Promise<void> {
    const item = await db.items.get(id);
    if (item) {
      await db.items.update(id, { lastOpenedAt: Date.now() });
    }
  }

  async deleteItem(id: string, showToast = true): Promise<void> {
    const item = await db.items.get(id);
    if (!item) return;

    // Delete stored file blobs if FileItem
    if (item.type === 'file') {
      const fileItem = item as FileItem;
      if (fileItem.files && fileItem.files.length > 0) {
        for (const f of fileItem.files) {
          if (f.opfsPath) {
            await fileService.deleteFile(f.opfsPath);
          }
        }
      } else if (fileItem.opfsPath) {
        await fileService.deleteFile(fileItem.opfsPath);
      }

      if (fileItem.thumbnailBlobUrl) {
        await fileService.deleteFile(fileItem.thumbnailBlobUrl);
      }
    }

    await db.items.delete(id);
    await searchService.remove(id);

    if (showToast) {
      toastStore.show('Đã xóa mục');
    }
  }
}

export const itemService = new ItemService();
