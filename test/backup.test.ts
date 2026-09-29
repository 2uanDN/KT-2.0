import assert from 'node:assert/strict';
import { sanitizeItem, remapTagsAndCollections, resolveConflict } from '../src/backup/sanitize';
import { BackupContainerWriter, BackupContainerReader } from '../src/backup/container';
import { ENTRY_NAMES, BACKUP_FORMAT, BACKUP_FORMAT_VERSION, BACKUP_MIN_READER_VERSION } from '../src/backup/constants';
import type { Tag } from '../src/types/tag';
import type { Collection } from '../src/types/collection';
import type { NoteItem, FileItem, LinkItem, Item } from '../src/types/item';

async function runTests() {
  console.log('=== Running Backup Test Suite ===\n');

  // -------------------------------------------------------------
  // TEST 1: sanitizeItem tests
  // -------------------------------------------------------------
  console.log('1. Testing sanitizeItem...');

  const tagIdMap = new Map<string, string>([['tag-old-1', 'tag-local-1']]);
  const colIdMap = new Map<string, string>([['col-old-1', 'col-local-1']]);
  const validTagIds = new Set<string>(['tag-local-1', 'tag-valid-2']);
  const validColIds = new Set<string>(['col-local-1', 'col-valid-2']);

  // 1.1 Invalid ID or type
  const badId = sanitizeItem({ type: 'note', body: 'test' }, tagIdMap, colIdMap, validTagIds, validColIds);
  assert.equal(badId.item, null);
  assert.ok(badId.error);

  const badType = sanitizeItem({ id: 'n1', type: 'unknown_type' }, tagIdMap, colIdMap, validTagIds, validColIds);
  assert.equal(badType.item, null);
  assert.ok(badType.error);

  // 1.2 Note: infer title from first line, prune bad tags, preserve extra fields
  const noteRaw = {
    id: 'note-1',
    type: 'note',
    body: '# Tieu de markdown dau tien\nNoi dung chi tiet o day.',
    tags: ['tag-old-1', 'tag-nonexistent'],
    collections: ['col-old-1'],
    isPinned: true,
    customFieldEmbed: { plugin: 'math', formula: 'E=mc^2' },
  };

  const noteRes = sanitizeItem(noteRaw, tagIdMap, colIdMap, validTagIds, validColIds);
  assert.ok(noteRes.item);
  assert.equal(noteRes.item.type, 'note');
  assert.equal(noteRes.item.title, 'Tieu de markdown dau tien');
  assert.equal(noteRes.item.normalizedTitle, 'tieu de markdown dau tien');
  assert.deepEqual(noteRes.item.tags, ['tag-local-1']);
  assert.deepEqual(noteRes.item.collections, ['col-local-1']);
  assert.equal((noteRes.item as any).customFieldEmbed.formula, 'E=mc^2');
  assert.ok(noteRes.warning?.includes('tag-nonexistent'));

  // 1.3 File: legacy single file without files[] array
  const legacyFileRaw = {
    id: 'file-1',
    type: 'file',
    originalFilename: 'document.pdf',
    opfsPath: 'doc-uuid-123.pdf',
    fileSizeBytes: 1024,
    mimeType: 'application/pdf',
    fileType: 'pdf',
  };
  const fileRes = sanitizeItem(legacyFileRaw, tagIdMap, colIdMap, validTagIds, validColIds);
  assert.ok(fileRes.item);
  const fileItem = fileRes.item as FileItem;
  assert.equal(fileItem.type, 'file');
  assert.equal(fileItem.title, 'document.pdf');
  assert.equal(fileItem.files?.length, 1);
  assert.equal(fileItem.files![0].opfsPath, 'doc-uuid-123.pdf');
  assert.equal(fileItem.files![0].fileSizeBytes, 1024);

  // 1.4 Link: normalize url, domain parse, fetchStatus
  const linkRaw = {
    id: 'link-1',
    type: 'link',
    url: 'https://example.com/docs/guide',
    previewImageUrl: 'https://example.com/og.jpg',
  };
  const linkRes = sanitizeItem(linkRaw, tagIdMap, colIdMap, validTagIds, validColIds);
  assert.ok(linkRes.item);
  const linkItem = linkRes.item as LinkItem;
  assert.equal(linkItem.domain, 'example.com');
  assert.equal(linkItem.fetchStatus, 'success');
  assert.equal(linkItem.title, 'example.com');

  console.log('✓ sanitizeItem passed all assertions.\n');

  // -------------------------------------------------------------
  // TEST 2: remapTagsAndCollections tests
  // -------------------------------------------------------------
  console.log('2. Testing remapTagsAndCollections...');

  const localTags: Tag[] = [
    { id: 'lt-1', name: 'kiến trúc', createdAt: 100 },
    { id: 'lt-2', name: 'lap-trinh', createdAt: 200 },
  ];
  const localCols: Collection[] = [
    { id: 'lc-1', name: 'Dự Án Cá Nhân', createdAt: 100 },
  ];

  const backupTags: Tag[] = [
    // Duplicate within backup with different casing that normalize to same
    { id: 'bt-dup-1', name: 'kiến trúc', createdAt: 300 },
    { id: 'bt-dup-2', name: 'Kiến Trúc', createdAt: 250 },
    // Direct match with local by ID
    { id: 'lt-2', name: 'lap-trinh', createdAt: 200 },
    // Brand new tag
    { id: 'bt-new-1', name: 'máy tính', createdAt: 400 },
  ];

  const backupCols: Collection[] = [
    // Same normalized as local collection
    { id: 'bc-1', name: 'dự án cá nhân', createdAt: 300 },
    // New collection
    { id: 'bc-new-1', name: 'Tài Liệu Nghiên Cứu', createdAt: 500 },
  ];

  const remapRes = remapTagsAndCollections(backupTags, backupCols, localTags, localCols);

  // 'kiến trúc' normalized matches local tag 'kien-truc' (lt-1)
  assert.equal(remapRes.tagIdMap.get('bt-dup-1'), 'lt-1');
  assert.equal(remapRes.tagIdMap.get('bt-dup-2'), 'lt-1');
  assert.equal(remapRes.tagIdMap.get('lt-2'), 'lt-2');
  // 'bt-new-1' gets created locally
  assert.equal(remapRes.tagsToCreate.length, 1);
  assert.equal(remapRes.tagsToCreate[0].id, 'bt-new-1');

  // Collection remap
  assert.equal(remapRes.colIdMap.get('bc-1'), 'lc-1');
  assert.equal(remapRes.colsToCreate.length, 1);
  assert.equal(remapRes.colsToCreate[0].id, 'bc-new-1');
  assert.equal(remapRes.colsToCreate[0].name, 'Tài Liệu Nghiên Cứu'); // preserved casing

  console.log('✓ remapTagsAndCollections passed all assertions.\n');

  // -------------------------------------------------------------
  // TEST 3: resolveConflict tests
  // -------------------------------------------------------------
  console.log('3. Testing resolveConflict...');

  const localItem: NoteItem = {
    id: 'item-1',
    type: 'note',
    status: 'saved',
    title: 'Bản cục bộ',
    body: 'Nội dung máy',
    isPinned: false,
    tags: [],
    collections: [],
    createdAt: 1000,
    savedAt: 1000,
    updatedAt: 2000,
    lastOpenedAt: 5000,
  };

  const backupNewerItem: NoteItem = {
    id: 'item-1',
    type: 'note',
    status: 'saved',
    title: 'Bản sao lưu mới hơn',
    body: 'Nội dung sao lưu',
    isPinned: true,
    tags: [],
    collections: [],
    createdAt: 1000,
    savedAt: 1000,
    updatedAt: 3000, // Newer than 2000
    lastOpenedAt: 4000,
  };

  const backupOlderItem: NoteItem = {
    ...backupNewerItem,
    title: 'Bản sao lưu cũ hơn',
    updatedAt: 1500, // Older than 2000
  };

  // 3.1 Policy 'skip'
  const skipRes = resolveConflict(localItem, backupNewerItem, 'skip');
  assert.equal(skipRes.winner.title, 'Bản cục bộ');
  assert.equal(skipRes.superseded, null);

  // 3.2 Policy 'overwrite'
  const overwriteRes = resolveConflict(localItem, backupOlderItem, 'overwrite');
  assert.equal(overwriteRes.winner.title, 'Bản sao lưu cũ hơn');
  assert.equal(overwriteRes.superseded?.title, 'Bản cục bộ');

  // 3.3 Policy 'newer'
  const newerResWin = resolveConflict(localItem, backupNewerItem, 'newer');
  assert.equal(newerResWin.winner.title, 'Bản sao lưu mới hơn');
  assert.equal(newerResWin.winner.lastOpenedAt, 5000); // max(5000, 4000)
  assert.equal(newerResWin.superseded?.title, 'Bản cục bộ');

  const newerResLose = resolveConflict(localItem, backupOlderItem, 'newer');
  assert.equal(newerResLose.winner.title, 'Bản cục bộ');
  assert.equal(newerResLose.superseded, null);

  console.log('✓ resolveConflict passed all assertions.\n');

  // -------------------------------------------------------------
  // TEST 4: Container round-trip streaming tests
  // -------------------------------------------------------------
  console.log('4. Testing Container writer & reader round-trip...');

  const writer = new BackupContainerWriter();
  const manifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    minReaderVersion: BACKUP_MIN_READER_VERSION,
    app: { name: 'KhoTriThuc', build: 'KT 1.8', dbSchemaVersion: 6 },
    createdAt: Date.now(),
    options: { includeFiles: true },
    counts: { items: 1, byType: { note: 1, file: 0, link: 0 }, byStatus: { saved: 1, inbox: 0 }, tags: 1, collections: 0, blobs: 1 },
    sizes: { metadataBytes: 100, declaredBlobBytes: 15 },
  };

  await writer.addDeflateEntry(ENTRY_NAMES.MANIFEST, JSON.stringify(manifest));
  await writer.addDeflateEntry(ENTRY_NAMES.TAGS, JSON.stringify([{ id: 't1', name: 'tag1', createdAt: 100 }]));
  await writer.addDeflateEntry(ENTRY_NAMES.COLLECTIONS, JSON.stringify([]));
  await writer.addDeflateEntry(ENTRY_NAMES.ITEMS, JSON.stringify({ id: 'n1', type: 'note', title: 'Test Note', body: 'Hello' }));

  const sampleBlob = new Blob(['binary blob data 12345'], { type: 'text/plain' });
  await writer.addStoredBlob('blobs/test_sample.txt', sampleBlob);

  const trailer = {
    complete: true,
    completedAt: Date.now(),
    blobs: [{ path: 'test_sample.txt', role: 'source' as const, size: 23, status: 'ok' as const }],
  };
  await writer.addDeflateEntry(ENTRY_NAMES.TRAILER, JSON.stringify(trailer));

  const output = await writer.close();
  assert.ok(output.blob);
  assert.ok(output.sizeBytes > 0);

  const file = new File([output.blob], 'test.zip', { type: 'application/zip' });

  // 4.1 Test readMetadataEntries (Analyze mode)
  const metaHeader = await BackupContainerReader.readMetadataEntries(file);
  assert.equal(metaHeader.entryOrder[0], 'manifest.json');
  assert.equal(metaHeader.entryOrder[1], 'tags.json');
  assert.equal(metaHeader.entryOrder[2], 'collections.json');
  assert.equal(metaHeader.entryOrder[3], 'items.ndjson');
  assert.ok(metaHeader.manifestRaw.includes('khotrithuc-backup'));
  assert.ok(metaHeader.itemsNdjsonRaw.includes('Test Note'));

  // 4.2 Test readFullArchive (Execute mode)
  let blobDispatched = false;
  let trailerDispatched = false;

  await BackupContainerReader.readFullArchive(file, {
    onMetadata: async (h) => {
      assert.ok(h.manifestRaw.includes('khotrithuc-backup'));
    },
    onBlob: async (path, blob) => {
      assert.equal(path, 'test_sample.txt');
      const text = await blob.text();
      assert.equal(text, 'binary blob data 12345');
      blobDispatched = true;
    },
    onTrailer: async (t) => {
      assert.equal(t.complete, true);
      assert.equal(t.blobs.length, 1);
      trailerDispatched = true;
    },
  });

  assert.ok(blobDispatched);
  assert.ok(trailerDispatched);

  console.log('✓ Container streaming writer and reader passed all assertions.\n');

  console.log('🎉 ALL BACKUP TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
