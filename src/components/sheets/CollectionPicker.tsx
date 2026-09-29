import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from './Sheet';
import { db } from '../../db/database';
import { collectionService } from '../../services/CollectionService';
import { InlineError } from '../feedback/InlineError';

interface CollectionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCollectionIds: string[];
  onChange: (collectionIds: string[]) => void;
}

export const CollectionPicker: React.FC<CollectionPickerProps> = ({
  isOpen,
  onClose,
  selectedCollectionIds,
  onChange,
}) => {
  const [newCollectionName, setNewCollectionName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawCollections = useLiveQuery(() => db.collections.orderBy('createdAt').reverse().toArray(), []) || [];

  const collections = useMemo(
    () => collectionService.deduplicateCollections(rawCollections),
    [rawCollections]
  );

  // Reset form and error state when sheet opens or closes
  useEffect(() => {
    if (!isOpen) {
      setNewCollectionName('');
      setSearchFilter('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleToggle = (colId: string) => {
    if (selectedCollectionIds.includes(colId)) {
      onChange(selectedCollectionIds.filter((id) => id !== colId));
    } else {
      onChange(Array.from(new Set([...selectedCollectionIds, colId])));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCollectionName.trim();
    if (!trimmed) {
      setErrorMessage('Vui lòng nhập tên bộ sưu tập');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const created = await collectionService.createCollection(trimmed);
      onChange(Array.from(new Set([...selectedCollectionIds, created.id])));
      setNewCollectionName('');
    } catch (err) {
      console.error('Lỗi khi tạo bộ sưu tập:', err);
      const msg = err instanceof Error ? err.message : 'Không thể tạo bộ sưu tập mới. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Chọn Bộ Sưu Tập">
      <div className="space-y-4">
        {/* Create inline */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => {
              setNewCollectionName(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Tạo bộ sưu tập mới..."
            className="flex-1 px-3 py-1.5 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={!newCollectionName.trim() || isSubmitting}
            className="px-3.5 py-1.5 bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white rounded-lg text-xs font-mono font-bold border border-[#1B1B1B] shadow-hard-xs disabled:opacity-50 transition cursor-pointer press-xs flex items-center gap-1.5 shrink-0"
          >
            {isSubmitting && (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>TẠO</span>
          </button>
        </form>

        {/* Error message alert */}
        {errorMessage && (
          <InlineError message={errorMessage} />
        )}

        {/* Search existing collections */}
        {collections.length > 5 && (
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Lọc danh sách bộ sưu tập..."
            className="w-full px-3 py-1.5 border border-[#3D4A5C]/30 rounded-lg text-xs bg-[#FAF9F7] text-[#1B1B1B] focus:outline-none focus:border-[#3D4A5C]"
          />
        )}

        {/* Collection list */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {filteredCollections.length === 0 ? (
            <p className="text-xs text-[#75777D] py-3 text-center italic font-mono">
              {collections.length === 0
                ? 'Chưa có bộ sưu tập nào. Hãy tạo một bộ sưu tập ở trên.'
                : 'Không tìm thấy bộ sưu tập phù hợp.'}
            </p>
          ) : (
            filteredCollections.map((col) => {
              const isSelected = selectedCollectionIds.includes(col.id);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleToggle(col.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition text-left cursor-pointer press-xs ${
                    isSelected
                      ? 'bg-[#FAF9F7] text-[#1B1B1B] font-bold border-2 border-[#3D4A5C] shadow-hard-xs'
                      : 'hover:bg-[#FAF9F7] text-[#1B1B1B] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-[18px] text-[#3D4A5C]">
                      folder
                    </span>
                    <span className="truncate">{col.name}</span>
                  </div>
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
