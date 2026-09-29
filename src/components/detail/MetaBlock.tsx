import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db/database';
import type { Item } from '../../types/item';

interface MetaBlockProps {
  item: Item;
}

export const MetaBlock: React.FC<MetaBlockProps> = ({ item }) => {
  const tags = useLiveQuery(
    async () => {
      if (!item.tags || item.tags.length === 0) return [];
      return db.tags.where('id').anyOf(item.tags).toArray();
    },
    [item.tags]
  ) || [];

  const collections = useLiveQuery(
    async () => {
      if (!item.collections || item.collections.length === 0) return [];
      return db.collections.where('id').anyOf(item.collections).toArray();
    },
    [item.collections]
  ) || [];

  const formatTimestamp = (ts: number | null) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-3.5 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg shadow-hard-md space-y-2.5 text-xs font-mono">
      {/* Collections */}
      {collections.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="type-nano-code text-[#44474C] font-bold">
            BỘ SƯU TẬP:
          </span>
          {collections.map((col) => (
            <Link
              key={col.id}
              to={`/collections/${col.id}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#FFFFFF] border border-[#3D4A5C] text-[#1B1B1B] hover:border-[#1B1B1B] shadow-hard-xs transition"
            >
              <span className="material-symbols-outlined text-[13px] text-[#3D4A5C]">folder</span>
              <span>{col.name}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="type-nano-code text-[#44474C] font-bold">
          THẺ:
        </span>
        {tags.length > 0 ? (
          tags.map((tag) => (
            <Link
              key={tag.id}
              to={`/tags/${tag.id}`}
              className="px-2 py-0.5 rounded-sm bg-[#FFFFFF] border border-[#3D4A5C]/30 text-[#3D4A5C] hover:border-[#3D4A5C] shadow-hard-xs transition"
            >
              #{tag.name}
            </Link>
          ))
        ) : (
          <span className="type-nano-code text-[#75777D] italic">
            Chưa gắn thẻ
          </span>
        )}
      </div>

      {/* Timestamps */}
      <div className="pt-2 border-t border-[#3D4A5C]/20 grid grid-cols-2 gap-2 type-nano-code text-[#44474C]">
        <div>
          <span>TẠO LÚC: </span>
          <span className="text-[#1B1B1B] font-bold">{formatTimestamp(item.createdAt)}</span>
        </div>
        {item.savedAt && (
          <div>
            <span>ĐÃ GIỮ: </span>
            <span className="text-[#1B1B1B] font-bold">{formatTimestamp(item.savedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
