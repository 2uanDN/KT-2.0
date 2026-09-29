import React from 'react';

interface LoadMoreButtonProps {
  hasMore: boolean;
  onLoadMore: () => void;
  visibleCount: number;
  totalCount: number;
}

export const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  hasMore,
  onLoadMore,
  visibleCount,
  totalCount,
}) => {
  if (!hasMore) return null;

  return (
    <div className="pt-4 pb-8 flex flex-col items-center justify-center gap-2">
      <button
        type="button"
        onClick={onLoadMore}
        className="w-full max-w-[220px] py-2.5 px-4 bg-[#FAF9F7] hover:bg-[#FFFFFF] border border-[#3D4A5C] text-[#1B1B1B] font-mono font-bold text-xs rounded-lg shadow-hard-xs hover:shadow-hard-sm transition flex items-center justify-center gap-1.5 cursor-pointer press-sm"
      >
        <span>TẢI THÊM</span>
        <span className="material-symbols-outlined text-[16px]">expand_more</span>
      </button>
      <span className="type-nano-code text-[#75777D]">
        HIỂN THỊ {visibleCount} / {totalCount} MỤC
      </span>
    </div>
  );
};
