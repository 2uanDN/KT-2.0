import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from './Sheet';
import { db } from '../../db/database';
import { tagService } from '../../services/TagService';
import { InlineError } from '../feedback/InlineError';

interface TagPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}

export const TagPicker: React.FC<TagPickerProps> = ({
  isOpen,
  onClose,
  selectedTagIds,
  onChange,
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawTags = useLiveQuery(() => db.tags.orderBy('name').toArray(), []) || [];

  const allTags = useMemo(() => tagService.deduplicateTags(rawTags), [rawTags]);

  // Reset form and error state when sheet opens or closes
  useEffect(() => {
    if (!isOpen) {
      setNewTagName('');
      setSearchFilter('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleToggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange(Array.from(new Set([...selectedTagIds, tagId])));
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setErrorMessage('Vui lòng nhập tên thẻ');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const created = await tagService.getOrCreateTag(trimmed);
      onChange(Array.from(new Set([...selectedTagIds, created.id])));
      setNewTagName('');
    } catch (err) {
      console.error('Lỗi khi tạo thẻ:', err);
      const msg = err instanceof Error ? err.message : 'Không thể tạo thẻ mới. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Gán Thẻ (Tags)">
      <div className="space-y-4">
        {/* Create new tag inline form */}
        <form onSubmit={handleCreateTag} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[#3D4A5C] text-sm font-bold">
              #
            </span>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => {
                setNewTagName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Tạo thẻ mới..."
              className="w-full pl-6 pr-3 py-1.5 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
              disabled={isSubmitting}
            />
          </div>
          <button
            type="submit"
            disabled={!newTagName.trim() || isSubmitting}
            className="px-3.5 py-1.5 bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white rounded-lg text-xs font-mono font-bold border border-[#1B1B1B] shadow-hard-xs disabled:opacity-50 transition cursor-pointer press-xs flex items-center gap-1.5 shrink-0"
          >
            {isSubmitting && (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>THÊM</span>
          </button>
        </form>

        {/* Error message alert */}
        {errorMessage && (
          <InlineError message={errorMessage} />
        )}

        {/* Search existing tags */}
        {allTags.length > 5 && (
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Lọc danh sách thẻ..."
            className="w-full px-3 py-1.5 border border-[#3D4A5C]/30 rounded-lg text-xs bg-[#FAF9F7] text-[#1B1B1B] focus:outline-none focus:border-[#3D4A5C]"
          />
        )}

        {/* Tags list */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {filteredTags.length === 0 ? (
            <p className="text-xs text-[#75777D] py-3 text-center italic font-mono">
              {allTags.length === 0
                ? 'Chưa có thẻ nào. Nhập tên ở trên để tạo thẻ mới.'
                : 'Không tìm thấy thẻ phù hợp.'}
            </p>
          ) : (
            filteredTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggle(tag.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition text-left cursor-pointer press-xs ${
                    isSelected
                      ? 'bg-[#FAF9F7] text-[#1B1B1B] font-bold border-2 border-[#3D4A5C] shadow-hard-xs'
                      : 'hover:bg-[#FAF9F7] text-[#1B1B1B] border border-transparent'
                  }`}
                >
                  <span className="type-label-code font-bold">#{tag.name}</span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[18px] text-[#3D4A5C]">
                      check
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="pt-2 border-t border-[#3D4A5C]/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white rounded-lg text-xs font-mono font-bold border border-[#1B1B1B] shadow-hard-xs transition cursor-pointer press-xs"
          >
            XONG
          </button>
        </div>
      </div>
    </Sheet>
  );
};
