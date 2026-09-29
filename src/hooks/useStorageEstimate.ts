import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { backupService, type StorageEstimateInfo, type BackupEstimate } from '../backup';
import { getBackupMeta, getUnbackedChangesCount } from '../backup/backupMeta';

export interface StorageOverview {
  itemCount: number;
  tagCount: number;
  collectionCount: number;
  fileCount: number;
  approxBytes: number;
  usageBytes: number;
  quotaBytes: number;
  isPersisted: boolean;
  lastExportAt: number | null;
  lastImportAt: number | null;
  unbackedChangesCount: number;
  isLoading: boolean;
  requestPersistence: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useStorageEstimate(): StorageOverview {
  const itemCount = useLiveQuery(() => db.items.count()) ?? 0;
  const tagCount = useLiveQuery(() => db.tags.count()) ?? 0;
  const collectionCount = useLiveQuery(() => db.collections.count()) ?? 0;

  const [estimate, setEstimate] = useState<BackupEstimate>({ items: 0, files: 0, approxBytes: 0 });
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo>({
    usageBytes: 0,
    quotaBytes: 0,
    isPersisted: false,
  });
  const [meta, setMeta] = useState(() => getBackupMeta());
  const [unbackedChangesCount, setUnbackedChangesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [est, stInfo] = await Promise.all([
        backupService.estimate(),
        backupService.getStorageEstimate(),
      ]);
      const currentMeta = getBackupMeta();
      const unbacked = await getUnbackedChangesCount(currentMeta.lastExportAt);

      setEstimate(est);
      setStorageInfo(stInfo);
      setMeta(currentMeta);
      setUnbackedChangesCount(unbacked);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, itemCount, tagCount, collectionCount]);

  const requestPersistence = useCallback(async () => {
    const success = await backupService.requestPersistentStorage();
    if (success) {
      setStorageInfo((prev) => ({ ...prev, isPersisted: true }));
    }
    return success;
  }, []);

  return {
    itemCount,
    tagCount,
    collectionCount,
    fileCount: estimate.files,
    approxBytes: estimate.approxBytes,
    usageBytes: storageInfo.usageBytes,
    quotaBytes: storageInfo.quotaBytes,
    isPersisted: storageInfo.isPersisted,
    lastExportAt: meta.lastExportAt,
    lastImportAt: meta.lastImportAt,
    unbackedChangesCount,
    isLoading,
    requestPersistence,
    refresh,
  };
}
