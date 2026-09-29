import type { Item, ItemType, ItemStatus } from '../types/item';
import type { Tag } from '../types/tag';
import type { Collection } from '../types/collection';

export interface BackupManifest {
  format: 'khotrithuc-backup';
  formatVersion: number;
  minReaderVersion: number;
  app: {
    name: string;
    build: string;
    dbSchemaVersion: number;
  };
  createdAt: number;
  options: {
    includeFiles: boolean;
  };
  counts: {
    items: number;
    byType: Record<ItemType, number>;
    byStatus: Record<ItemStatus, number>;
    tags: number;
    collections: number;
    blobs: number;
  };
  sizes: {
    metadataBytes: number;
    declaredBlobBytes: number;
  };
}

export type BlobRole = 'source' | 'thumbnail';
export type BlobStatus = 'ok' | 'missing' | 'error';

export interface BackupTrailerBlob {
  path: string;
  role: BlobRole;
  size: number;
  status: BlobStatus;
}

export interface BackupTrailer {
  complete: boolean;
  completedAt: number;
  blobs: BackupTrailerBlob[];
}

export interface ExportProgress {
  phase: 'snapshot' | 'pack' | 'finalize';
  message: string;
  doneBytes: number;
  totalBytes: number;
  doneBlobs: number;
  totalBlobs: number;
}

export interface ExportOptions {
  includeFiles: boolean;
  signal?: AbortSignal;
  writableStream?: FileSystemWritableFileStream | null;
  onProgress?: (p: ExportProgress) => void;
}

export interface ExportResult {
  fileName: string;
  sizeBytes: number;
  counts: {
    items: number;
    tags: number;
    collections: number;
    blobs: number;
  };
  missingBlobs: string[];
  durationMs: number;
  delivery: 'saved-to-disk' | 'ready-for-download';
  blob?: Blob;
}

export type ImportMode = 'merge' | 'replace';
export type ConflictPolicy = 'skip' | 'newer' | 'overwrite';

export interface AnalyzeResult {
  manifest: BackupManifest;
  parsedTagsCount: number;
  parsedCollectionsCount: number;
  parsedItemsCount: number;
  parsedBlobsCount: number;
  newItemsCount: number;
  existingSameIdCount: number;
  backupNewerCount: number;
  localNewerCount: number;
  tagsToRemapCount: number;
  collectionsToRemapCount: number;
  droppedInvalidCount: number;
  warnings: string[];
  canReplace: boolean;
  // Sanitized in-memory entities for execution
  parsedItems: Item[];
  parsedTags: Tag[];
  parsedCollections: Collection[];
}

export interface ImportProgress {
  phase: 'select' | 'analyze' | 'staging' | 'verify' | 'commit' | 'post';
  message: string;
  percent?: number;
  doneBytes?: number;
  totalBytes?: number;
  doneItems?: number;
  totalItems?: number;
  doneBlobs?: number;
  totalBlobs?: number;
}

export interface ImportOptions {
  mode: ImportMode;
  conflict: ConflictPolicy;
  signal?: AbortSignal;
  onProgress?: (p: ImportProgress) => void;
}

export interface ImportReport {
  mode: ImportMode;
  conflict: ConflictPolicy;
  durationMs: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsSkipped: number;
  tagsCreated: number;
  tagsMerged: number;
  collectionsCreated: number;
  collectionsMerged: number;
  blobsStored: number;
  blobsReused: number;
  blobsRenamed: number;
  warnings: string[];
  errors: string[];
}
