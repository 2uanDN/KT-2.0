import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Item, ItemType, NoteItem, FileItem, LinkItem, StoredFile } from '../../types/item';
import { NoteEditorForm } from './NoteEditorForm';
import { FileEditorForm } from './FileEditorForm';
import { LinkEditorForm } from './LinkEditorForm';
import type { CommonEditorMeta } from './types';

export interface EditorFormProps {
  initialItem?: Item;
  isEditing?: boolean;
  defaultType?: ItemType;
  defaultTitle?: string;
}

function areStringArraysEqual(a?: string[], b?: string[]): boolean {
  if (a === b) return true;
  const arrA = a || [];
  const arrB = b || [];
  if (arrA.length !== arrB.length) return false;
  const sortedA = [...arrA].sort();
  const sortedB = [...arrB].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

function areFilesEqual(a?: StoredFile[], b?: StoredFile[]): boolean {
  if (a === b) return true;
  const arrA = a || [];
  const arrB = b || [];
  if (arrA.length !== arrB.length) return false;
  return arrA.every((f, idx) => f.id === arrB[idx].id && f.fileSizeBytes === arrB[idx].fileSizeBytes);
}

function isSameItemContent(a?: Item, b?: Item): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.id !== b.id || a.type !== b.type) return false;

  // Compare core content fields across items
  // Note: Metadata fields (isPinned, lastOpenedAt, updatedAt) are explicitly excluded
  // so external bookmarking, reading touches, or non-content updates do not trigger false positive conflict warnings
  if (
    (a.title || '') !== (b.title || '') ||
    a.status !== b.status
  ) {
    return false;
  }

  if (!areStringArraysEqual(a.tags, b.tags)) return false;
  if (!areStringArraysEqual(a.collections, b.collections)) return false;

  if (a.type === 'note' && b.type === 'note') {
    if (((a as NoteItem).body || '') !== ((b as NoteItem).body || '')) return false;
  } else if (a.type === 'link' && b.type === 'link') {
    if ((a as LinkItem).url !== (b as LinkItem).url) return false;
    if (((a as LinkItem).reason || '') !== ((b as LinkItem).reason || '')) return false;
  } else if (a.type === 'file' && b.type === 'file') {
    const fileA = a as FileItem;
    const fileB = b as FileItem;
    if ((fileA.displayName || '') !== (fileB.displayName || '')) return false;
    if ((fileA.caption || '') !== (fileB.caption || '')) return false;
    if (fileA.opfsPath !== fileB.opfsPath) return false;
    if (fileA.thumbnailFileId !== fileB.thumbnailFileId) return false;
    if (!areFilesEqual(fileA.files, fileB.files)) return false;
  }

  return true;
}

export const EditorForm: React.FC<EditorFormProps> = ({
  initialItem,
  isEditing = false,
  defaultType = 'note',
  defaultTitle = '',
}) => {
  const [type, setType] = useState<ItemType>(initialItem?.type || defaultType);

  useEffect(() => {
    if (!isEditing && defaultType && !initialItem) {
      setType(defaultType);
    }
  }, [defaultType, isEditing, initialItem]);

  const [commonMeta, setCommonMeta] = useState<CommonEditorMeta>(() => ({
    title: initialItem?.title || defaultTitle || '',
    tags: Array.from(new Set(initialItem?.tags || [])),
    collections: Array.from(new Set(initialItem?.collections || [])),
    isPinned: initialItem?.isPinned || false,
    keepLong: initialItem ? initialItem.status === 'saved' : true,
  }));

  // Track the baseline item that this editor is currently synchronized with
  const lastSyncedItemRef = useRef<Item | undefined>(initialItem);

  // Track the previous initialItem received from props to detect external DB changes
  const prevInitialItemRef = useRef<Item | undefined>(initialItem);

  // Track the latest initialItem from props so callbacks maintain stable references across liveQuery updates
  const latestItemRef = useRef<Item | undefined>(initialItem);
  latestItemRef.current = initialItem;

  // Track whether the child form (body, file queue, url) has been modified by the user
  const [isChildDirty, setIsChildDirty] = useState(false);

  // Sync key used to force-remount child editor forms when reloading or auto-syncing from DB
  const [syncKey, setSyncKey] = useState(0);

  // Conflict state when external update occurs while editor has unsaved changes
  const [hasConflict, setHasConflict] = useState(false);

  // Check if commonMeta itself has unsaved edits compared to lastSyncedItemRef
  const isMetaDirty = Boolean(
    lastSyncedItemRef.current && (
      commonMeta.title !== (lastSyncedItemRef.current.title || '') ||
      !areStringArraysEqual(commonMeta.tags, lastSyncedItemRef.current.tags) ||
      !areStringArraysEqual(commonMeta.collections, lastSyncedItemRef.current.collections) ||
      commonMeta.isPinned !== (lastSyncedItemRef.current.isPinned || false) ||
      commonMeta.keepLong !== (lastSyncedItemRef.current.status === 'saved')
    )
  );

  const effectiveIsDirty = isChildDirty || isMetaDirty;

  // React to initialItem updates from parent (e.g. useLiveQuery in EditScreen)
  useEffect(() => {
    if (!isEditing || !initialItem) return;

    const prevItem = prevInitialItemRef.current;
    if (!prevItem) {
      prevInitialItemRef.current = initialItem;
      lastSyncedItemRef.current = initialItem;
      return;
    }

    // If ID changed entirely
    if (prevItem.id !== initialItem.id) {
      setCommonMeta({
        title: initialItem.title || '',
        tags: Array.from(new Set(initialItem.tags || [])),
        collections: Array.from(new Set(initialItem.collections || [])),
        isPinned: initialItem.isPinned || false,
        keepLong: initialItem.status === 'saved',
      });
      setType(initialItem.type);
      lastSyncedItemRef.current = initialItem;
      prevInitialItemRef.current = initialItem;
      setHasConflict(false);
      setIsChildDirty(false);
      setSyncKey((k) => k + 1);
      return;
    }

    // If initialItem reference did not change (e.g. effect ran due to dirty state or pin state change)
    if (prevItem === initialItem) {
      return;
    }

    // If item content changed in the database
    if (!isSameItemContent(prevItem, initialItem)) {
      if (effectiveIsDirty) {
        // User has unsaved edits in this editor session -> prompt conflict warning
        setHasConflict(true);
        // Keep user's draft intact; do NOT overwrite lastSyncedItemRef yet
      } else {
        // Form is clean -> automatically synchronize state to the fresh DB item
        setCommonMeta({
          title: initialItem.title || '',
          tags: Array.from(new Set(initialItem.tags || [])),
          collections: Array.from(new Set(initialItem.collections || [])),
          isPinned: initialItem.isPinned || false,
          keepLong: initialItem.status === 'saved',
        });
        setType(initialItem.type);
        lastSyncedItemRef.current = initialItem;
        setSyncKey((k) => k + 1);
      }
    } else {
      // Content is identical (only metadata like isPinned, lastOpenedAt, or updatedAt changed)
      // If user hasn't explicitly toggled isPinned locally, keep it smoothly in sync
      if (prevItem.isPinned !== initialItem.isPinned && commonMeta.isPinned === (prevItem.isPinned || false)) {
        setCommonMeta((prev) => ({ ...prev, isPinned: initialItem.isPinned || false }));
      }
      if (!effectiveIsDirty) {
        lastSyncedItemRef.current = initialItem;
      }
    }

    // Always advance prevInitialItemRef to current initialItem
    prevInitialItemRef.current = initialItem;
  }, [initialItem, isEditing, effectiveIsDirty, commonMeta.isPinned]);

  const handleCommonMetaChange = useCallback((updates: Partial<CommonEditorMeta>) => {
    setCommonMeta((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleReloadLatest = useCallback(() => {
    const latestItem = latestItemRef.current;
    if (latestItem) {
      setCommonMeta({
        title: latestItem.title || '',
        tags: Array.from(new Set(latestItem.tags || [])),
        collections: Array.from(new Set(latestItem.collections || [])),
        isPinned: latestItem.isPinned || false,
        keepLong: latestItem.status === 'saved',
      });
      setType(latestItem.type);
      lastSyncedItemRef.current = latestItem;
      prevInitialItemRef.current = latestItem;
    }
    setHasConflict(false);
    setIsChildDirty(false);
    setSyncKey((k) => k + 1);
  }, []);

  const handleDismissConflict = useCallback(() => {
    // Acknowledge the external change; user keeps current draft and can overwrite
    lastSyncedItemRef.current = latestItemRef.current;
    prevInitialItemRef.current = latestItemRef.current;
    setHasConflict(false);
  }, []);

  const conflictBanner = hasConflict ? (
    <div
      role="alert"
      className="p-3.5 bg-[#FBE3B3] text-[#1B1B1B] border-2 border-[#8A5A00] rounded-lg shadow-hard-xs space-y-2 animate-in fade-in duration-200"
    >
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-[#8A5A00] text-xl shrink-0 select-none">
          warning
        </span>
        <div className="flex-1 text-xs">
          <p className="font-bold text-[#8A5A00] uppercase font-mono tracking-wider">
            Cảnh báo cập nhật đồng thời
          </p>
          <p className="mt-0.5 text-[#1B1B1B] leading-relaxed">
            Mục này vừa được cập nhật từ tab hoặc phiên làm việc khác. Nếu lưu bây giờ, bạn có thể ghi đè nội dung mới đó.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleReloadLatest}
          className="px-3 py-1.5 bg-[#3D4A5C] text-white rounded text-xs font-mono font-bold hover:bg-[#1B1B1B] transition cursor-pointer shadow-hard-xs press-xs"
        >
          TẢI LẠI DỮ LIỆU MỚI NHẤT
        </button>
        <button
          type="button"
          onClick={handleDismissConflict}
          className="px-3 py-1.5 bg-white/80 border border-[#3D4A5C]/40 text-[#3D4A5C] rounded text-xs font-mono font-bold hover:bg-white transition cursor-pointer press-xs"
        >
          BỎ QUA &amp; GIỮ BẢN NHÁP
        </button>
      </div>
    </div>
  ) : null;

  if (type === 'file') {
    return (
      <FileEditorForm
        key={`${initialItem?.id || 'new'}-${syncKey}`}
        initialItem={initialItem?.type === 'file' ? (initialItem as FileItem) : undefined}
        isEditing={isEditing}
        commonMeta={commonMeta}
        onCommonMetaChange={handleCommonMetaChange}
        onTypeChange={isEditing ? undefined : setType}
        conflictBanner={conflictBanner}
        onDirtyChange={setIsChildDirty}
      />
    );
  }

  if (type === 'link') {
    return (
      <LinkEditorForm
        key={`${initialItem?.id || 'new'}-${syncKey}`}
        initialItem={initialItem?.type === 'link' ? (initialItem as LinkItem) : undefined}
        isEditing={isEditing}
        commonMeta={commonMeta}
        onCommonMetaChange={handleCommonMetaChange}
        onTypeChange={isEditing ? undefined : setType}
        conflictBanner={conflictBanner}
        onDirtyChange={setIsChildDirty}
      />
    );
  }

  return (
    <NoteEditorForm
      key={`${initialItem?.id || 'new'}-${syncKey}`}
      initialItem={initialItem?.type === 'note' ? (initialItem as NoteItem) : undefined}
      isEditing={isEditing}
      commonMeta={commonMeta}
      onCommonMetaChange={handleCommonMetaChange}
      onTypeChange={isEditing ? undefined : setType}
      conflictBanner={conflictBanner}
      onDirtyChange={setIsChildDirty}
    />
  );
};
