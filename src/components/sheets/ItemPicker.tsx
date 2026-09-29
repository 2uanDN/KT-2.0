import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from './Sheet';
import { db } from '../../db/database';
import type { Item } from '../../types/item';

interface ItemPickerProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  onAddItem: (itemId: string) => Promise<void> | void;
}

export const ItemPicker: React.FC<ItemPickerProps> = ({
  isOpen,
  onClose,
  collectionId,
  onAddItem,
}) => {
  const [search, setSearch] = useState('');

  const savedItems = useLiveQuery(
    () => db.items.where('status').equals('saved').toArray(),
    []
  ) || [];

  // Exclude items already in this collection
  const availableItems = savedItems.filter(
    (item) => !item.collections?.includes(collectionId)
  );

  const filteredItems = availableItems.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase().trim())
  );

  const getTypeInfo = (type: Item['type']) => {
    switch (type) {
      case 'note':
        return {
          icon: 'description',
          label: 'Ghi chú',
          borderClass: 'border-t-2 border-t-[#E8D4B8]',
          iconClass: 'text-[#1B1B1B] bg-[#E8D4B8]',
        };
      case 'file':
        return {
          icon: 'draft',
          label: 'Tệp',
          borderClass: 'border-t-2 border-t-[#D4A5A5]',
          iconClass: 'text-[#1B1B1B] bg-[#D4A5A5]',
        };
      case 'link':
        return {
          icon: 'link',
          label: 'Liên kết',
          borderClass: 'border-t-2 border-t-[#B9B08A]',
          iconClass: 'text-[#1B1B1B] bg-[#B9B08A]',
        };
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Thêm mục đã giữ vào Bộ sưu tập">
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm mục đã lưu..."
          className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
        />

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {filteredItems.length === 0 ? (
            <p className="text-xs text-[#75777D] py-6 text-center italic font-mono">
              {availableItems.length === 0
                ? 'Không có mục đã giữ nào chưa thuộc bộ này.'
                : 'Không tìm thấy mục phù hợp.'}
            </p>
          ) : (
            filteredItems.map((item) => {
              const info = getTypeInfo(item.type);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={async () => {
                    await onAddItem(item.id);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 bg-[#FAF9F7] hover:bg-[#FFFFFF] border border-[#3D4A5C]/30 hover:border-[#3D4A5C] rounded-lg text-left transition group cursor-pointer shadow-hard-xs hover:shadow-hard-sm press-xs ${info.borderClass}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 border border-[#3D4A5C]/20 ${info.iconClass}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {info.icon}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1B1B1B] truncate group-hover:text-[#3D4A5C]">
                        {item.title}
                      </p>
                      <p className="type-nano-code text-[#44474C]">
                        {info.label.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-[#3D4A5C] opacity-70 group-hover:opacity-100">
                    add_circle
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Sheet>
  );
};
