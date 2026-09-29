import assert from 'node:assert/strict';
import { BackupContainerWriter, BackupContainerReader } from '../src/backup/container';
import { BackupAnalyzer } from '../src/backup/BackupAnalyzer';
import { BackupError } from '../src/backup/errors';
import {
  ENTRY_NAMES,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_MIN_READER_VERSION,
} from '../src/backup/constants';

async function runIntegrationTests() {
  console.log('=== Running Backup Integration & Edge Cases Test Suite ===\n');

  const analyzer = new BackupAnalyzer();

  // -------------------------------------------------------------
  // TEST 1: Corrupted or truncated archive detection
  // -------------------------------------------------------------
  console.log('1. Testing truncated/incomplete archive...');

  const writer = new BackupContainerWriter();
  const manifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    minReaderVersion: BACKUP_MIN_READER_VERSION,
    app: { name: 'KhoTriThuc', build: 'KT 1.8', dbSchemaVersion: 6 },
    createdAt: Date.now(),
    options: { includeFiles: false },
    counts: { items: 0, byType: { note: 0, file: 0, link: 0 }, byStatus: { saved: 0, inbox: 0 }, tags: 0, collections: 0, blobs: 0 },
    sizes: { metadataBytes: 10, declaredBlobBytes: 0 },
  };

  await writer.addDeflateEntry(ENTRY_NAMES.MANIFEST, JSON.stringify(manifest));
  // Stop without adding tags, collections, items, trailer!
  const incompleteZip = await writer.close();
  const incompleteFile = new File([incompleteZip.blob!], 'incomplete.zip', { type: 'application/zip' });

  await assert.rejects(
    async () => {
      await analyzer.analyze(incompleteFile);
    },
    (err: any) => {
      return err instanceof BackupError && (err.code === 'ARCHIVE_INCOMPLETE' || err.code === 'ENTRY_ORDER_INVALID');
    },
    'Should reject incomplete archive'
  );
  console.log('✓ Incomplete archive rejected cleanly.\n');

  // -------------------------------------------------------------
  // TEST 2: Invalid entry order detection
  // -------------------------------------------------------------
  console.log('2. Testing invalid entry order...');

  const writerBadOrder = new BackupContainerWriter();
  // Wrong order: put items first, then manifest
  await writerBadOrder.addDeflateEntry(ENTRY_NAMES.ITEMS, '');
  await writerBadOrder.addDeflateEntry(ENTRY_NAMES.MANIFEST, JSON.stringify(manifest));
  await writerBadOrder.addDeflateEntry(ENTRY_NAMES.TAGS, '[]');
  await writerBadOrder.addDeflateEntry(ENTRY_NAMES.COLLECTIONS, '[]');
  const badOrderZip = await writerBadOrder.close();
  const badOrderFile = new File([badOrderZip.blob!], 'bad_order.zip', { type: 'application/zip' });

  await assert.rejects(
    async () => {
      await analyzer.analyze(badOrderFile);
    },
    (err: any) => {
      return err instanceof BackupError && err.code === 'ENTRY_ORDER_INVALID';
    },
    'Should reject archive with invalid entry order'
  );
  console.log('✓ Invalid entry order rejected cleanly.\n');

  // -------------------------------------------------------------
  // TEST 3: Not a backup file (e.g. random text file or arbitrary zip)
  // -------------------------------------------------------------
  console.log('3. Testing non-backup zip...');

  const writerNonBackup = new BackupContainerWriter();
  await writerNonBackup.addDeflateEntry('hello.txt', 'not a backup');
  const nonBackupZip = await writerNonBackup.close();
  const nonBackupFile = new File([nonBackupZip.blob!], 'arbitrary.zip', { type: 'application/zip' });

  await assert.rejects(
    async () => {
      await analyzer.analyze(nonBackupFile);
    },
    (err: any) => {
      return err instanceof BackupError && (err.code === 'ENTRY_ORDER_INVALID' || err.code === 'NOT_A_BACKUP');
    },
    'Should reject arbitrary non-backup file'
  );
  console.log('✓ Non-backup file rejected cleanly.\n');

  console.log('🎉 ALL INTEGRATION EDGE CASES PASSED! 🎉');
}

runIntegrationTests().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
