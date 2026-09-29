export const BACKUP_FORMAT = 'khotrithuc-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_MIN_READER_VERSION = 1;

export const APP_NAME = 'KhoTriThuc';
export const APP_BUILD = 'KT 1.8';
export const DB_SCHEMA_VERSION = 6;

/**
 * Metadata in-memory ceiling (256 MB) to prevent browser tab OOM crashes.
 */
export const MAX_METADATA_BYTES = 256 * 1024 * 1024;

/**
 * Batched write threshold (150 MB).
 * Datasets exceeding this are committed in batched transactions (<= 200 items/batch).
 */
export const BATCH_METADATA_THRESHOLD_BYTES = 150 * 1024 * 1024;
export const BATCH_SIZE = 200;

export const ENTRY_NAMES = {
  MANIFEST: 'manifest.json',
  TAGS: 'tags.json',
  COLLECTIONS: 'collections.json',
  ITEMS: 'items.ndjson',
  BLOBS_PREFIX: 'blobs/',
  TRAILER: 'trailer.json',
} as const;

export const EXPECTED_ENTRY_ORDER = [
  ENTRY_NAMES.MANIFEST,
  ENTRY_NAMES.TAGS,
  ENTRY_NAMES.COLLECTIONS,
  ENTRY_NAMES.ITEMS,
] as const;

export const BACKUP_LOCKS = {
  CLEANUP_PIPELINE: 'kt_bg_cleanup_pipeline_lock',
  EXPORT_MUTEX: 'kt_backup_export_lock',
  IMPORT_MUTEX: 'kt_backup_import_lock',
} as const;
