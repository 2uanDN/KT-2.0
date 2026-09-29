import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLibraryStore, type TypeFilter } from '../../store/libraryStore';
import { FilterChip } from './FilterChip';
import { db } from '../../db/database';

export const FilterBar: React.FC = () => {
  const {
    activeTypeFilter,
    activeTagFilter,
    setTypeFilter,
    setTagFilter,
  } = useLibraryStore();

  const activeTag = useLiveQuery(
    async () => {
      if (!activeTagFilter) return undefined;
      const tag = await db.tags.get(activeTagFilter);
      return tag ?? null;
    },
    [activeTagFilter]
  );

  React.useEffect(() => {
    // If activeTagFilter is set, but the tag is confirmed to not exist in the database (null),
    // automatically clear the stale activeTagFilter so the user isn't stuck with 0 results.
    if (activeTagFilter && activeTag === null) {
      setTagFilter(null);
    }
  }, [activeTagFilter, activeTag, setTagFilter]);

  const typeChips: { id: TypeFilter; label: string; icon: string }[] = [
    { id: 'all', label: 'TẤT CẢ', icon: 'grid_view' },
    { id: 'pinned', label: 'ĐÃ GHIM', icon: 'push_pin' },
    { id: 'note', label: 'GHI CHÚ', icon: 'description' },
    { id: 'file', label: 'TỆP', icon: 'draft' },
    { id: 'link', label: 'LIÊN KẾT', icon: 'link' },
  ];

  return (
    <div className="w-full bg-[#FAF9F7] border-b border-[#3D4A5C]/20 select-none">
      {/* 
        Danh sách bộ lọc cuộn ngang với lớp overlay màu nền 32px (w-8)
      */}
      <div className="relative w-full">
        <div className="w-full overflow-x-auto no-scrollbar py-2.5 px-3 sm:px-4">
          <div className="flex items-center gap-1.5 min-w-max pr-8">
            {typeChips.map((chip) => (
              <FilterChip
                key={chip.id}
                label={chip.label}
                icon={chip.icon}
                isActive={activeTypeFilter === chip.id}
                onClick={() => setTypeFilter(chip.id)}
              />
            ))}

            {/* Active Tag Chip (Additive) */}
            {activeTag && (
              <FilterChip
                label={`#${activeTag.name.toUpperCase()}`}
                isActive={true}
                onClick={() => {}}
                onClear={() => setTagFilter(null)}
              />
            )}
          </div>
        </div>

        {/* Lớp overlay màu nền 32px (w-8) */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#FAF9F7] to-transparent z-10" />
      </div>
    </div>
  );
};


