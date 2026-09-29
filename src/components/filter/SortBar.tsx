import React from 'react';
import { useLibraryStore, getSortLabel } from '../../store/libraryStore';

interface SortBarProps {
  onOpenSort: () => void;
}

export const SortBar: React.FC<SortBarProps> = ({ onOpenSort }) => {
  const { sortMode } = useLibraryStore();

  return (
    <div className="w-full bg-[#FAF9F7] px-3 sm:px-4 py-2 border-b border-[#3D4A5C]/20 select-none">
      <button
        type="button"
        onClick={onOpenSort}
        className="w-full flex items-center justify-between h-[36px] px-3.5 rounded-lg border border-[#3D4A5C] bg-[#3D4A5C]/10 hover:bg-[#3D4A5C]/15 hover:border-[#1B1B1B] text-[#1B1B1B] shadow-hard-xs hover:shadow-hard-sm transition-all cursor-pointer whitespace-nowrap select-none press-xs"
        aria-label="Sắp xếp danh sách"
        title="Sắp xếp danh sách"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[17px] text-[#3D4A5C] shrink-0">
            sort
          </span>
          <span className="type-label-code-bold text-[#1B1B1B] truncate">
            SẮP XẾP: <span className="text-[#3D4A5C] font-bold">{getSortLabel(sortMode)}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-[#3D4A5C] shrink-0">
          <span className="material-symbols-outlined text-[18px]">
            expand_more
          </span>
        </div>
      </button>
    </div>
  );
};
