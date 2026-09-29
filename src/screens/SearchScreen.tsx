import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/shell/TopBar';
import { ItemCard } from '../components/list/ItemCard';
import { EmptyState } from '../components/list/EmptyState';
import { FilterChip } from '../components/filter/FilterChip';
import { searchService } from '../services/SearchService';
import { useBatchTags } from '../hooks/useBatchTags';
import { db } from '../db/database';
import type { Item, ItemType } from '../types/item';

export const SearchScreen: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ItemType | 'all'>('all');
  const [results, setResults] = useState<Item[]>([]);
  const [totalHitsCount, setTotalHitsCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const tagMap = useBatchTags(results);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotalHitsCount(0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const typeFilter = selectedType === 'all' ? undefined : selectedType;
        const allHits = await searchService.search(query, { type: typeFilter });
        setTotalHitsCount(allHits.length);

        if (allHits.length === 0) {
          setResults([]);
        } else {
          // Bounded load: take top 50 ranked hits to protect DOM and memory
          const searchHits = allHits.slice(0, 50);
          const itemPromises = searchHits.map((h) => db.items.get(h.id));
          const loadedItems = await Promise.all(itemPromises);
          setResults(loadedItems.filter((item): item is Item => Boolean(item)));
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, selectedType]);

  const typeFilterOptions: { id: ItemType | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'TẤT CẢ', icon: 'grid_view' },
    { id: 'note', label: 'GHI CHÚ', icon: 'description' },
    { id: 'file', label: 'TỆP', icon: 'draft' },
    { id: 'link', label: 'LIÊN KẾT', icon: 'link' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF] min-h-screen">
      <TopBar
        variant="search"
        query={query}
        onQueryChange={setQuery}
        onCancel={() => navigate(-1)}
      />

      {/* Filter chips with 32px overlay */}
      <div className="relative w-full bg-[#FAF9F7] border-b border-[#3D4A5C]/20 select-none">
        <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar pr-8">
          {typeFilterOptions.map((opt) => (
            <FilterChip
              key={opt.id}
              label={opt.label}
              icon={opt.icon}
              isActive={selectedType === opt.id}
              onClick={() => setSelectedType(opt.id)}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#FAF9F7] to-transparent z-10" />
      </div>

      <div className="p-4 flex-1">
        {isSearching && (
          <div className="py-8 text-center text-xs font-mono text-[#75777D]">
            <span className="inline-block w-4 h-4 border-2 border-[#3D4A5C] border-t-transparent rounded-full animate-spin mb-1" />
            <p>Đang tìm kiếm trong kho tri thức...</p>
          </div>
        )}

        {!query.trim() && (
          <div className="py-16 text-center text-[#75777D]">
            <span className="material-symbols-outlined text-[36px] text-[#3D4A5C]/40 mb-2">
              manage_search
            </span>
            <p className="type-headline-xs text-[#1B1B1B]">Tìm kiếm trong toàn bộ tri thức</p>
            <p className="type-body-xs text-[#44474C] mt-1 max-w-xs mx-auto">
              Tìm theo tiêu đề, nội dung ghi chú, tên tệp, địa chỉ web hoặc ghi chú lý do lưu.
            </p>
          </div>
        )}

        {query.trim() && !isSearching && results.length === 0 && (
          <EmptyState
            title="Không tìm thấy kết quả"
            subtitle={`Không có mục nào khớp với từ khóa "${query}".`}
            icon="search_off"
          />
        )}

        {results.length > 0 && !isSearching && (
          <div className="space-y-3">
            <p className="type-label-code-bold text-[#3D4A5C] px-1">
              TÌM THẤY {totalHitsCount} KẾT QUẢ PHÙ HỢP{totalHitsCount > 50 ? ' (HIỂN THỊ 50 MỤC ĐẦU)' : ''}:
            </p>
            <div className="grid grid-cols-1 gap-3">
              {results.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  tagMap={tagMap}
                  onOpen={(id) => navigate(`/items/${id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
