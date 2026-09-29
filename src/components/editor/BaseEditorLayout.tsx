import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FormBar } from './FormBar';
import { PinSwitch } from './PinSwitch';
import { KeepSwitch } from './KeepSwitch';
import { TypeSwitcher } from './TypeSwitcher';
import { InlineError } from '../feedback/InlineError';
import { TagPicker } from '../sheets/TagPicker';
import { CollectionPicker } from '../sheets/CollectionPicker';
import { ConfirmSheet } from '../sheets/ConfirmSheet';
import { db } from '../../db/database';
import type { ItemType } from '../../types/item';

export interface BaseEditorLayoutProps {
  title: string;
  selectedType: ItemType;
  isEditing: boolean;
  onTypeChange?: (type: ItemType) => void;
  isDirty: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  onCancel?: () => void;
  onSubmit: () => void;
  formError?: string | null;
  conflictBanner?: React.ReactNode;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  collections: string[];
  onCollectionsChange: (collections: string[]) => void;
  isPinned: boolean;
  onPinChange: (pinned: boolean) => void;
  keepLong: boolean;
  onKeepLongChange: (keepLong: boolean) => void;
  children: React.ReactNode;
}

export const BaseEditorLayout: React.FC<BaseEditorLayoutProps> = ({
  title,
  selectedType,
  isEditing,
  onTypeChange,
  isDirty,
  isSubmitting,
  canSubmit,
  onCancel,
  onSubmit,
  formError,
  conflictBanner,
  tags,
  onTagsChange,
  collections,
  onCollectionsChange,
  isPinned,
  onPinChange,
  keepLong,
  onKeepLongChange,
  children,
}) => {
  const navigate = useNavigate();

  // State for metadata sheets & cancel confirmation
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Live queries for tags and collections to display chip labels
  const tagObjects =
    useLiveQuery(
      async () => {
        if (tags.length === 0) return [];
        return db.tags.where('id').anyOf(tags).toArray();
      },
      [tags.join(',')]
    ) || [];

  const collectionObjects =
    useLiveQuery(
      async () => {
        if (collections.length === 0) return [];
        return db.collections.where('id').anyOf(collections).toArray();
      },
      [collections.join(',')]
    ) || [];

  const handleExit = () => {
    const hasHistory =
      typeof window !== 'undefined' &&
      ((typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) ||
        (window.history.state?.idx === undefined && window.history.length > 1));

    if (hasHistory) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      handleExit();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#ffffff] min-h-screen">
      <FormBar
        title={title}
        onCancel={handleCancel}
        onSubmit={onSubmit}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
        canSubmit={canSubmit}
      />

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full pb-20">
        {conflictBanner}
        {formError && <InlineError message={formError} />}

        {/* Type Switcher (only selectable during creation if onTypeChange is provided) */}
        {!isEditing && onTypeChange && (
          <div>
            <label className="type-label-code-bold text-[#3D4A5C] mb-1.5 block">
              Loại tri thức
            </label>
            <TypeSwitcher selectedType={selectedType} onChange={onTypeChange} />
          </div>
        )}

        {/* Specialized form fields (Note / File / Link) */}
        {children}

        {/* METADATA: TAGS & COLLECTIONS */}
        <div className="pt-2 border-t border-[#3D4A5C]/20 space-y-3">
          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="type-label-code-bold text-[#3D4A5C]">
                Thẻ (Tags)
              </label>
              <button
                type="button"
                onClick={() => setShowTagPicker(true)}
                className="type-label-code-bold text-[#3D4A5C] hover:text-[#1B1B1B] flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>GÁN THẺ</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] shadow-hard-xs">
              {tagObjects.length === 0 ? (
                <span className="text-xs text-[#75777D] italic font-mono">Chưa gán thẻ nào</span>
              ) : (
                tagObjects.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#FFFFFF] text-[#3D4A5C] border border-[#3D4A5C]/30 text-xs font-mono font-bold shadow-hard-xs"
                  >
                    <span>#{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => onTagsChange(tags.filter((id) => id !== tag.id))}
                      className="hover:opacity-75 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Collections */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="type-label-code-bold text-[#3D4A5C]">
                Bộ sưu tập
              </label>
              <button
                type="button"
                onClick={() => setShowColPicker(true)}
                className="type-label-code-bold text-[#3D4A5C] hover:text-[#1B1B1B] flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>CHỌN BỘ</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] shadow-hard-xs">
              {collectionObjects.length === 0 ? (
                <span className="text-xs text-[#75777D] italic font-mono">Chưa vào bộ sưu tập nào</span>
              ) : (
                collectionObjects.map((col) => (
                  <span
                    key={col.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#FFFFFF] text-[#1B1B1B] border border-[#3D4A5C] text-xs font-medium shadow-hard-xs"
                  >
                    <span className="material-symbols-outlined text-[14px] text-[#3D4A5C]">folder</span>
                    <span>{col.name}</span>
                    <button
                      type="button"
                      onClick={() => onCollectionsChange(collections.filter((id) => id !== col.id))}
                      className="hover:opacity-75 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Pin Switch */}
          <PinSwitch isPinned={isPinned} onChange={onPinChange} />

          {/* Keep Switch (Giữ lâu dài vs Hộp chờ) */}
          <KeepSwitch keepLong={keepLong} onChange={onKeepLongChange} />
        </div>
      </div>

      {/* Sheets & Dialogs */}
      <TagPicker
        isOpen={showTagPicker}
        onClose={() => setShowTagPicker(false)}
        selectedTagIds={tags}
        onChange={onTagsChange}
      />

      <CollectionPicker
        isOpen={showColPicker}
        onClose={() => setShowColPicker(false)}
        selectedCollectionIds={collections}
        onChange={onCollectionsChange}
      />

      <ConfirmSheet
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleExit}
        title="Rời khỏi trang?"
        customMessage="Bạn có thay đổi chưa lưu. Nếu rời đi, các thông tin vừa nhập sẽ bị mất."
        confirmLabel="Rời đi"
        isDestructive={true}
      />
    </div>
  );
};
