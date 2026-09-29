import type { Item, NoteItem, FileItem, LinkItem, StoredFile } from '../types/item';
import type { Tag } from '../types/tag';
import type { Collection } from '../types/collection';
import type { ConflictPolicy } from './types';
import { normalizeTitle } from '../utils/vietnamese';
import { tagService } from '../services/TagService';
import { collectionService } from '../services/CollectionService';
import { linkMetaService } from '../services/LinkMetaService';

export interface SanitizeItemResult {
  item: Item | null;
  warning?: string;
  error?: string;
}

export interface RemapResult {
  tagIdMap: Map<string, string>; // backupTagId -> localTagId
  colIdMap: Map<string, string>; // backupColId -> localColId
  tagsToCreate: Tag[];
  colsToCreate: Collection[];
  tagsMergedCount: number;
  colsMergedCount: number;
  validTagIds: Set<string>;
  validColIds: Set<string>;
}

/**
 * Normalizes tags and collections, deduplicates within backup,
 * and matches against existing local database entities.
 */
export function remapTagsAndCollections(
  backupTags: Tag[],
  backupCols: Collection[],
  localTags: Tag[],
  localCols: Collection[]
): RemapResult {
  const tagIdMap = new Map<string, string>();
  const colIdMap = new Map<string, string>();

  const localTagById = new Map<string, Tag>();
  const localTagByNorm = new Map<string, Tag>();
  for (const t of localTags) {
    localTagById.set(t.id, t);
    const norm = tagService.normalizeTagName(t.name);
    if (!localTagByNorm.has(norm)) {
      localTagByNorm.set(norm, t);
    }
  }

  const localColById = new Map<string, Collection>();
  const localColByNorm = new Map<string, Collection>();
  for (const c of localCols) {
    localColById.set(c.id, c);
    const norm = collectionService.normalizeCollectionName(c.name);
    if (!localColByNorm.has(norm)) {
      localColByNorm.set(norm, c);
    }
  }

  // Group backup tags by normalized name
  const backupTagsByNorm = new Map<string, Tag[]>();
  for (const t of backupTags) {
    if (!t || !t.name) continue;
    const norm = tagService.normalizeTagName(t.name);
    if (!backupTagsByNorm.has(norm)) {
      backupTagsByNorm.set(norm, []);
    }
    backupTagsByNorm.get(norm)!.push(t);
  }

  let tagsMergedCount = 0;
  const tagsToCreate: Tag[] = [];
  const validTagIds = new Set<string>(localTags.map((t) => t.id));

  for (const [norm, group] of backupTagsByNorm.entries()) {
    // Sort group by createdAt ascending so earliest is primary
    group.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const earliestBackupTag = group[0];

    // Check if any tag in group matches a local tag by ID, or if local tag exists by normalized name
    let targetTagId: string | undefined;
    for (const bt of group) {
      if (localTagById.has(bt.id)) {
        targetTagId = bt.id;
        break;
      }
    }

    if (!targetTagId) {
      const normLocal = localTagByNorm.get(norm);
      if (normLocal) {
        targetTagId = normLocal.id;
      } else {
        // Brand new tag to create locally
        targetTagId = earliestBackupTag.id;
        const cleanName = norm.slice(0, 50);
        tagsToCreate.push({
          id: targetTagId,
          name: cleanName,
          createdAt: earliestBackupTag.createdAt || Date.now(),
        });
        validTagIds.add(targetTagId);
      }
    }

    // Map all backup tags in this normalized group to targetTagId
    for (const bt of group) {
      tagIdMap.set(bt.id, targetTagId);
      if (bt.id !== targetTagId) {
        tagsMergedCount++;
      }
    }
  }

  // Group backup collections by normalized name
  const backupColsByNorm = new Map<string, Collection[]>();
  for (const c of backupCols) {
    if (!c || !c.name) continue;
    const norm = collectionService.normalizeCollectionName(c.name);
    if (!backupColsByNorm.has(norm)) {
      backupColsByNorm.set(norm, []);
    }
    backupColsByNorm.get(norm)!.push(c);
  }

  let colsMergedCount = 0;
  const colsToCreate: Collection[] = [];
  const validColIds = new Set<string>(localCols.map((c) => c.id));

  for (const [norm, group] of backupColsByNorm.entries()) {
    group.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const earliestCol = group[0];

    let targetColId: string | undefined;
    for (const bc of group) {
      if (localColById.has(bc.id)) {
        targetColId = bc.id;
        break;
      }
    }

    if (!targetColId) {
      const normLocal = localColByNorm.get(norm);
      if (normLocal) {
        targetColId = normLocal.id;
      } else {
        targetColId = earliestCol.id;
        colsToCreate.push({
          id: targetColId,
          name: earliestCol.name.trim(), // Keep casing of first occurrence
          createdAt: earliestCol.createdAt || Date.now(),
        });
        validColIds.add(targetColId);
      }
    }

    for (const bc of group) {
      colIdMap.set(bc.id, targetColId);
      if (bc.id !== targetColId) {
        colsMergedCount++;
      }
    }
  }

  return {
    tagIdMap,
    colIdMap,
    tagsToCreate,
    colsToCreate,
    tagsMergedCount,
    colsMergedCount,
    validTagIds,
    validColIds,
  };
}

/**
 * Sanitizes a raw deserialized item from backup according to Section IV.3 rules.
 */
export function sanitizeItem(
  raw: any,
  tagIdMap: Map<string, string>,
  colIdMap: Map<string, string>,
  validTagIds: Set<string>,
  validColIds: Set<string>
): SanitizeItemResult {
  if (!raw || typeof raw !== 'object') {
    return { item: null, error: 'Mục không đúng định dạng dữ liệu đối tượng' };
  }

  // 1. ID check
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) {
    return { item: null, error: 'Mục thiếu định danh (id) bắt buộc' };
  }

  // 2. Type check
  const type = raw.type;
  if (type !== 'note' && type !== 'file' && type !== 'link') {
    return { item: null, error: `Loại mục "${type}" không hợp lệ cho mục ${id}` };
  }

  // 3. Status
  let status: 'inbox' | 'saved' = raw.status;
  if (status !== 'inbox' && status !== 'saved') {
    status = raw.savedAt ? 'saved' : 'inbox';
  }

  // 4. Timestamps
  const createdAt = typeof raw.createdAt === 'number' && !isNaN(raw.createdAt) ? raw.createdAt : Date.now();
  const savedAt = status === 'saved' ? (typeof raw.savedAt === 'number' ? raw.savedAt : createdAt) : null;
  const updatedAt = typeof raw.updatedAt === 'number' && !isNaN(raw.updatedAt) ? raw.updatedAt : (savedAt || createdAt);
  const lastOpenedAt = typeof raw.lastOpenedAt === 'number' && !isNaN(raw.lastOpenedAt) ? raw.lastOpenedAt : null;
  const isPinned = Boolean(raw.isPinned);

  // 5. Tags and Collections remapping and pruning
  const warnings: string[] = [];
  const rawTags = Array.isArray(raw.tags) ? raw.tags : [];
  const sanitizedTags: string[] = [];
  for (const t of rawTags) {
    if (typeof t === 'string' && t.trim()) {
      const mapped = tagIdMap.get(t.trim()) || t.trim();
      if (validTagIds.has(mapped)) {
        if (!sanitizedTags.includes(mapped)) {
          sanitizedTags.push(mapped);
        }
      } else {
        warnings.push(`Mục "${id}" bỏ tham chiếu thẻ không tồn tại "${t}"`);
      }
    }
  }

  const rawCols = Array.isArray(raw.collections) ? raw.collections : [];
  const sanitizedCols: string[] = [];
  for (const c of rawCols) {
    if (typeof c === 'string' && c.trim()) {
      const mapped = colIdMap.get(c.trim()) || c.trim();
      if (validColIds.has(mapped)) {
        if (!sanitizedCols.includes(mapped)) {
          sanitizedCols.push(mapped);
        }
      } else {
        warnings.push(`Mục "${id}" bỏ tham chiếu bộ sưu tập không tồn tại "${c}"`);
      }
    }
  }

  // 6. Base Item
  const base = {
    ...raw, // preserve extra fields like embeds
    id,
    type,
    status,
    isPinned,
    tags: sanitizedTags,
    collections: sanitizedCols,
    createdAt,
    savedAt,
    updatedAt,
    lastOpenedAt,
  };

  // 7. Domain-specific validation
  if (type === 'note') {
    const body = typeof raw.body === 'string' ? raw.body : '';
    let title = typeof raw.title === 'string' ? raw.title.trim() : '';
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
    return { item: noteItem, warning: warnings.length > 0 ? warnings.join('; ') : undefined };
  }

  if (type === 'link') {
    const rawUrl = typeof raw.url === 'string' ? raw.url.trim() : '';
    const url = linkMetaService.normalizeUrl(rawUrl);
    const domain = raw.domain || linkMetaService.parseDomain(url) || '';
    const fetchedTitle = typeof raw.fetchedTitle === 'string' ? raw.fetchedTitle.trim() : null;
    const previewImageUrl = typeof raw.previewImageUrl === 'string' ? raw.previewImageUrl.trim() : null;
    let title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) {
      title = fetchedTitle || domain || 'Liên kết web';
    }
    const fetchStatus = raw.fetchStatus || (fetchedTitle || previewImageUrl ? 'success' : 'idle');
    const reason = typeof raw.reason === 'string' ? raw.reason : '';

    const linkItem: LinkItem = {
      ...base,
      type: 'link',
      title,
      normalizedTitle: normalizeTitle(title),
      url,
      domain,
      reason,
      fetchedTitle,
      previewImageUrl,
      fetchStatus,
    };
    return { item: linkItem, warning: warnings.length > 0 ? warnings.join('; ') : undefined };
  }

  // File Item
  const fileType = raw.fileType === 'image' || raw.fileType === 'markdown' ? raw.fileType : 'pdf';
  const originalFilename = typeof raw.originalFilename === 'string' ? raw.originalFilename : 'file.bin';
  const displayName = typeof raw.displayName === 'string' && raw.displayName.trim()
    ? raw.displayName.trim()
    : (typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : originalFilename);
  const title = displayName;
  const caption = typeof raw.caption === 'string' ? raw.caption : '';
  const fileSizeBytes = typeof raw.fileSizeBytes === 'number' && !isNaN(raw.fileSizeBytes) ? raw.fileSizeBytes : 0;
  const mimeType = typeof raw.mimeType === 'string' ? raw.mimeType : 'application/octet-stream';
  const opfsPath = typeof raw.opfsPath === 'string' ? raw.opfsPath : '';

  // Process files[] array or synthesize
  let files: StoredFile[] = [];
  if (Array.isArray(raw.files) && raw.files.length > 0) {
    for (const f of raw.files) {
      if (f && typeof f === 'object') {
        files.push({
          id: typeof f.id === 'string' ? f.id : crypto.randomUUID(),
          originalFilename: typeof f.originalFilename === 'string' ? f.originalFilename : originalFilename,
          displayName: typeof f.displayName === 'string' ? f.displayName : undefined,
          fileSizeBytes: typeof f.fileSizeBytes === 'number' ? f.fileSizeBytes : 0,
          opfsPath: typeof f.opfsPath === 'string' ? f.opfsPath : '',
          mimeType: typeof f.mimeType === 'string' ? f.mimeType : mimeType,
          fileType: f.fileType === 'image' || f.fileType === 'markdown' ? f.fileType : 'pdf',
          isThumbnail: Boolean(f.isThumbnail),
        });
      }
    }
  } else if (opfsPath) {
    files = [
      {
        id: crypto.randomUUID(),
        originalFilename,
        displayName,
        fileSizeBytes,
        opfsPath,
        mimeType,
        fileType,
        isThumbnail: Boolean(raw.thumbnailBlobUrl),
      },
    ];
  }

  const fileItem: FileItem = {
    ...base,
    type: 'file',
    title,
    normalizedTitle: normalizeTitle(title),
    displayName,
    fileType,
    originalFilename,
    caption,
    fileSizeBytes,
    opfsPath: opfsPath || (files[0]?.opfsPath || ''),
    mimeType,
    thumbnailBlobUrl: typeof raw.thumbnailBlobUrl === 'string' ? raw.thumbnailBlobUrl : undefined,
    thumbnailFileId: typeof raw.thumbnailFileId === 'string' ? raw.thumbnailFileId : undefined,
    files,
  };

  return { item: fileItem, warning: warnings.length > 0 ? warnings.join('; ') : undefined };
}

/**
 * Resolves conflict between a local item and a backup item with the same ID according to policy.
 */
export function resolveConflict(
  localItem: Item,
  backupItem: Item,
  policy: ConflictPolicy
): { winner: Item; superseded: Item | null } {
  if (policy === 'skip') {
    return { winner: localItem, superseded: null };
  }

  if (policy === 'overwrite') {
    return { winner: backupItem, superseded: localItem };
  }

  // 'newer' policy
  const localTime = (localItem.updatedAt ?? localItem.savedAt ?? localItem.createdAt) || 0;
  const backupTime = (backupItem.updatedAt ?? backupItem.savedAt ?? backupItem.createdAt) || 0;

  if (backupTime > localTime) {
    // Backup item wins, merge max lastOpenedAt
    const maxOpened = Math.max(localItem.lastOpenedAt || 0, backupItem.lastOpenedAt || 0) || null;
    return {
      winner: {
        ...backupItem,
        lastOpenedAt: maxOpened,
      },
      superseded: localItem,
    };
  }

  // Local item wins or tie (tie keeps local item)
  return { winner: localItem, superseded: null };
}
