import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/shell/TopBar';
import { EmptyState } from '../components/list/EmptyState';
import { tagService } from '../services/TagService';
import { db } from '../db/database';

export const TagsScreen: React.FC = () => {
  const navigate = useNavigate();

  const rawTags = useLiveQuery(() => db.tags.orderBy('name').toArray(), []) || [];

  // Deduplicate display tags using centralized tag service logic
  const tags = useMemo(() => tagService.deduplicateTags(rawTags), [rawTags]);

  // Count distinct item usage for each tag using multi-entry index without full table scan
  const tagCounts = useLiveQuery(async () => {
    const allTags = await db.tags.toArray();
    const map: Record<string, number> = {};
    await Promise.all(
      allTags.map(async (tag) => {
        map[tag.id] = await db.items.where('tags').equals(tag.id).count();
      })
    );
    return map;
  }, []) || {};

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF]">
      <TopBar
        variant="list"
        title="Thẻ phân loại"
        onSearchClick={() => navigate('/search')}
      />

      <div className="p-4 flex-1">
        {tags.length === 0 ? (
          <EmptyState
            title="Chưa có thẻ nào"
            subtitle="Bạn có thể tạo thẻ mới khi lưu hoặc chỉnh sửa một mục tri thức."
            icon="tag"
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {tags.map((tag) => {
              const count = tagCounts[tag.id] || 0;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => navigate(`/tags/${tag.id}`)}
                  className="p-3 bg-[#FAF9F7] hover:bg-[#FFFFFF] border border-[#3D4A5C] hover:border-[#1B1B1B] shadow-hard-md hover:shadow-hard-sm rounded-lg flex items-center justify-between text-left transition group cursor-pointer press-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="type-label-code-bold text-[#1B1B1B] group-hover:text-[#3D4A5C] truncate">
                      #{tag.name}
                    </p>
                    <p className="type-nano-code text-[#44474C] mt-1">
                      {count} MỤC
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[16px] text-[#3D4A5C] group-hover:translate-x-0.5 transition-transform">
                    chevron_right
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
