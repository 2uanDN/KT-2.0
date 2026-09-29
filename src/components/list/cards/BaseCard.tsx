import React, { useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/database';
import { itemService } from '../../../services/ItemService';
import { toastStore } from '../../../store/toastStore';
import { CollectionPicker } from '../../sheets/CollectionPicker';
import { ConfirmSheet } from '../../sheets/ConfirmSheet';
import { getTypeTheme, formatDate, type CardVariant, type TypeTheme } from './cardUtils';
import type { Item } from '../../../types/item';
import type { Tag } from '../../../types/tag';

export interface BaseCardProps {
  item: Item;
  variant?: CardVariant;
  onOpen: (id: string) => void;
  tags?: Tag[];
  theme?: TypeTheme;
  customTypeLabel?: React.ReactNode;
  headerBadges?: React.ReactNode;
  contextLine?: string;
  mediaSlot?: React.ReactNode;
  children?: React.ReactNode;
}

export const BaseCard: React.FC<BaseCardProps> = ({
  item,
  variant = 'library',
  onOpen,
  tags: tagsProp,
  theme,
  customTypeLabel,
  headerBadges,
  contextLine,
  mediaSlot,
  children,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const cardTheme = useMemo(() => theme || getTypeTheme(item), [theme, item]);

  // Optimization: When pre-resolved tags are provided directly via props (e.g. batch-loaded in parent list),
  // skip Dexie query. If not provided, query Dexie for item.tags.
  const isExternallyProvided = tagsProp !== undefined;
  const itemTagIdsKey = item.tags && item.tags.length > 0 ? item.tags.join(',') : '';

  const queriedTags = useLiveQuery(
    async () => {
      if (isExternallyProvided || !item.tags || item.tags.length === 0) return [];
      return db.tags.where('id').anyOf(item.tags).toArray();
    },
    [isExternallyProvided, itemTagIdsKey]
  );

  const tags = tagsProp ?? queriedTags ?? [];

  const formattedDate = useMemo(
    () => formatDate(item.savedAt || item.createdAt),
    [item.savedAt, item.createdAt]
  );

  const handleOpen = useCallback(() => {
    onOpen(item.id);
  }, [onOpen, item.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(item.id);
      }
    },
    [onOpen, item.id]
  );

  const handleMoveToSaved = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await itemService.moveItem(item.id, 'saved');
      } catch (err) {
        console.error('Failed to move item to saved:', err);
        toastStore.show('Không thể chuyển mục vào Thư viện');
      }
    },
    [item.id]
  );

  const handleToggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu((prev) => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setShowMenu(false);
  }, []);

  const handleOpenColPicker = useCallback(() => {
    setShowMenu(false);
    setShowColPicker(true);
  }, []);

  const handleCloseColPicker = useCallback(() => {
    setShowColPicker(false);
  }, []);

  const handleTogglePin = useCallback(async () => {
    setShowMenu(false);
    try {
      await itemService.togglePin(item.id);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      toastStore.show('Không thể cập nhật trạng thái ghim');
    }
  }, [item.id]);

  const handleOpenDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowMenu(false);
      setShowDeleteConfirm(true);
    },
    []
  );

  const handleCloseDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleSaveToCollection = useCallback(
    async (selectedIds: string[]) => {
      try {
        await itemService.updateItem(item.id, { collections: selectedIds });
      } catch (err) {
        console.error('Failed to update collections:', err);
        toastStore.show('Không thể cập nhật bộ sưu tập');
      }
    },
    [item.id]
  );

  const handleConfirmDelete = useCallback(async () => {
    try {
      await itemService.deleteItem(item.id);
    } catch (err) {
      console.error('Failed to delete item:', err);
      toastStore.show('Không thể xóa mục');
    }
  }, [item.id]);

  return (
    <>
      <article
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        aria-label={`${cardTheme.label}: ${item.title}`}
        className="group relative bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] shadow-hard-md hover:border-[#1B1B1B] hover:shadow-hard-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D4A5C] focus-visible:ring-offset-2 transition-all duration-150 overflow-hidden text-left cursor-pointer flex flex-col"
      >
        {/* 6px Top Accent Strip */}
        <div
          className="h-1.5 w-full shrink-0 border-b border-[#3D4A5C]/20"
          style={{ backgroundColor: cardTheme.accentColor }}
        />

        {/* Media slot (e.g. Thumbnail preview) */}
        {mediaSlot}

        {/* Card Body */}
        <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            {/* Header: Accent dot + Type label and Badges */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {/* 10px accent dot */}
                <span
                  className="w-2.5 h-2.5 rounded-xs border border-[#3D4A5C]/40 shrink-0"
                  style={{ backgroundColor: cardTheme.accentColor }}
                />
                <span className="type-label-code-bold text-[#3D4A5C] truncate">
                  {customTypeLabel || cardTheme.label}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {headerBadges}
                {item.isPinned && (
                  <span
                    className="material-symbols-outlined text-[16px] text-[#3D4A5C]"
                    title="Đã ghim"
                  >
                    push_pin
                  </span>
                )}
                {item.status === 'inbox' && variant === 'library' && (
                  <span className="px-1.5 py-0.5 rounded-sm type-nano-code font-bold bg-[#E0DFDE] text-[#1B1B1B] border border-[#3D4A5C]/30">
                    HỘP CHỜ
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <h2 className="type-headline-xs text-[#1B1B1B] group-hover:text-[#3D4A5C] line-clamp-2 leading-snug mb-1 break-words [overflow-wrap:anywhere]">
              {item.title}
            </h2>

            {/* Context line */}
            {contextLine && (
              <p className="type-body-sm text-[#44474C] line-clamp-2 leading-relaxed mb-2 break-words [overflow-wrap:anywhere]">
                {contextLine}
              </p>
            )}

            {/* Sub-type content */}
            {children}
          </div>

          {/* Footer: Tags and Timestamps */}
          <div className="pt-2 border-t border-[#3D4A5C]/20 flex items-center justify-between text-[11px] text-[#75777D]">
            <div className="flex items-center gap-1 overflow-hidden flex-wrap">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="type-label-code px-1.5 py-0.5 rounded-xs bg-[#FFFFFF] border border-[#3D4A5C]/20 text-[#3D4A5C]"
                >
                  #{t.name}
                </span>
              ))}
            </div>
            <span className="type-nano-code shrink-0 ml-2 font-mono text-[#75777D]">
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Inbox Variant: Action row */}
        {variant === 'inbox' && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="border-t border-[#3D4A5C]/20 bg-[#FFFFFF] px-3 py-2 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMoveToSaved}
                className="inline-flex items-center gap-1 font-bold text-xs text-white bg-[#3D4A5C] hover:bg-[#1B1B1B] px-3 py-1.5 rounded-md border border-[#1B1B1B] shadow-hard-xs transition cursor-pointer press-xs"
              >
                <span className="material-symbols-outlined text-[15px]">bookmark_add</span>
                <span>Giữ lâu dài</span>
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={handleToggleMenu}
                className="p-1.5 rounded-md text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#FAF9F7] cursor-pointer"
                aria-label="Tùy chọn khác"
              >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={handleCloseMenu}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 bottom-full mb-1 z-30 w-48 bg-[#FFFFFF] border-2 border-[#3D4A5C] rounded-lg shadow-hard-lg py-1 text-xs">
                    <button
                      type="button"
                      onClick={handleOpenColPicker}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF9F7] text-[#1B1B1B] cursor-pointer font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">
                        folder
                      </span>
                      <span>Cho vào bộ sưu tập</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTogglePin}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF9F7] text-[#1B1B1B] cursor-pointer font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">
                        push_pin
                      </span>
                      <span>{item.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenDelete}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FFDAD6] text-[#BA1A1A] cursor-pointer font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Xóa mục</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </article>

      {/* Collection Picker Dialog */}
      <CollectionPicker
        isOpen={showColPicker}
        onClose={handleCloseColPicker}
        selectedCollectionIds={item.collections || []}
        onChange={handleSaveToCollection}
      />

      {/* Delete Confirmation Sheet */}
      <ConfirmSheet
        isOpen={showDeleteConfirm}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        item={item}
      />
    </>
  );
};
