import React from 'react';
import { Sheet } from '../sheets/Sheet';
import { useLibraryStore, SORT_OPTIONS } from '../../store/libraryStore';

interface SortSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SortSheet: React.FC<SortSheetProps> = ({ isOpen, onClose }) => {
  const { sortMode, setSortMode } = useLibraryStore();

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Sắp Xếp Danh Sách">
      <div className="space-y-2.5">
        {SORT_OPTIONS.map((opt) => {
          const isSelected = sortMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setSortMode(opt.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between p-3.5 rounded-lg border text-left transition cursor-pointer press-xs ${
                isSelected
                  ? 'bg-[#FAF9F7] hover:bg-[#F3F1ED] border-2 border-[#3D4A5C] hover:border-[#1B1B1B] text-[#1B1B1B] shadow-hard-xs hover:shadow-hard-sm'
                  : 'bg-[#FFFFFF] hover:bg-[#FAF9F7] border border-[#3D4A5C]/25 hover:border-[#3D4A5C] text-[#1B1B1B]'
              }`}
            >
              <div>
                <p className="type-label-code-bold text-[#1B1B1B]">{opt.label}</p>
                <p className="type-body-xs text-[#44474C] mt-1">{opt.desc}</p>
              </div>
              {isSelected && (
                <span className="material-symbols-outlined text-[22px] text-[#3D4A5C]">
                  check_circle
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
};
