import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/shell/TopBar';
import { ItemCard } from '../components/list/ItemCard';
import { EmptyState } from '../components/list/EmptyState';
import { LoadMoreButton } from '../components/list/LoadMoreButton';
import { useScrollPreservation } from '../hooks/useScrollPreservation';
import { useBatchTags } from '../hooks/useBatchTags';
import { usePaginatedItems } from '../hooks/usePaginatedItems';
import { db } from '../db/database';
import type { Item } from '../types/item';

export const InboxScreen: React.FC = () => {
  const navigate = useNavigate();
  const listRef = useScrollPreservation('inbox');

  const inboxItems = useLiveQuery(
    () => db.items.where('status').equals('inbox').reverse().sortBy('createdAt'),
    []
  ) || [];

  const {
    items: displayItems,
    hasMore,
    loadMore,
    totalCount,
    visibleCount,
  } = usePaginatedItems<Item>(inboxItems, 'inbox');

  const tagMap = useBatchTags(displayItems);

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF]" ref={listRef}>
      <TopBar
        variant="list"
        title="Hộp chờ"
        onSearchClick={() => navigate('/search')}
      />

      <div className="p-4 flex-1">
        {totalCount === 0 ? (
          <EmptyState
            title="Hộp chờ đã trống"
            subtitle="Mọi tri thức tạm thời đã được phân loại hoặc chuyển vào Thư viện chính thức."
            icon="task_alt"
          />
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg shadow-hard-xs flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#3D4A5C] flex items-center justify-center text-white shrink-0 shadow-hard-xs">
                <span className="material-symbols-outlined text-[18px]">inbox</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="type-label-code-bold text-[#1B1B1B]">
                    ĐANG CÓ {totalCount} MỤC CHỜ PHÂN LOẠI
                  </span>
                  <span className="px-1.5 py-0.5 rounded-xs bg-[#D4A5A5] text-[#1B1B1B] type-nano-code font-bold border border-[#3D4A5C]/20">
                    TẠM THỜI
                  </span>
                </div>
                <p className="type-body-xs text-[#44474C] leading-relaxed mt-0.5">
                  Bấm <strong className="font-bold text-[#1B1B1B]">"Giữ lâu dài"</strong> trên thẻ mục để chuyển vào Thư viện chính thức.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {displayItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  tagMap={tagMap}
                  variant="inbox"
                  onOpen={(id) => navigate(`/items/${id}`)}
                />
              ))}
            </div>

            <LoadMoreButton
              hasMore={hasMore}
              onLoadMore={loadMore}
              visibleCount={visibleCount}
              totalCount={totalCount}
            />
          </div>
        )}
      </div>
    </div>
  );
};
