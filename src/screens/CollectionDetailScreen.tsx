import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/shell/TopBar';
import { ItemCard } from '../components/list/ItemCard';
import { EmptyState } from '../components/list/EmptyState';
import { ItemPicker } from '../components/sheets/ItemPicker';
import { NameSheet } from '../components/sheets/NameSheet';
import { ConfirmSheet } from '../components/sheets/ConfirmSheet';
import { collectionService } from '../services/CollectionService';
import { useBatchTags } from '../hooks/useBatchTags';
import { db } from '../db/database';
import type { Collection } from '../types/collection';
import type { Item } from '../types/item';
import type { QueryState } from '../types/query';

export const CollectionDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showRenameSheet, setShowRenameSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const collectionQuery = useLiveQuery<QueryState<Collection>>(
    async () => {
      if (!id) return { status: 'notFound' };
      const result = await db.collections.get(id);
      return result ? { status: 'found', data: result } : { status: 'notFound' };
    },
    [id]
  );

  const items = useLiveQuery<Item[]>(
    async () => {
      if (!id) return [];
      const list = await db.items.where('collections').equals(id).toArray();
      const uniqueMap = new Map<string, Item>();
      for (const item of list) {
        uniqueMap.set(item.id, item);
      }
      return Array.from(uniqueMap.values());
    },
    [id]
  ) || [];

  const tagMap = useBatchTags(items);

  const queryState: QueryState<Collection> = collectionQuery ?? { status: 'loading' };

  if (queryState.status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <span className="w-6 h-6 border-2 border-[#3D4A5C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (queryState.status === 'notFound') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="type-headline-xs text-[#BA1A1A]">Không tìm thấy bộ sưu tập</p>
        <button
          onClick={() => navigate('/collections')}
          className="mt-3 px-4 py-2 bg-[#3D4A5C] text-white rounded-lg text-xs font-mono font-bold shadow-hard-xs hover:bg-[#1B1B1B] transition cursor-pointer press-xs"
        >
          QUAY LẠI BỘ SƯU TẬP
        </button>
      </div>
    );
  }

  const collection = queryState.data;

  const handleAddItem = async (itemId: string) => {
    if (!id) return;
    await collectionService.addItemToCollection(itemId, id);
  };

  const handleRename = async (name: string) => {
    if (!id) return;
    await collectionService.updateCollection(id, name);
  };

  const handleDelete = async () => {
    if (!id) return;
    await collectionService.deleteCollection(id);
    navigate('/collections', { replace: true });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF] min-h-screen">
      <TopBar
        variant="detail"
        backLabel="Bộ sưu tập"
        onBack={() => navigate('/collections')}
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowItemPicker(true)}
              className="p-1.5 text-[#3D4A5C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] rounded-md transition press-xs cursor-pointer"
              title="Thêm mục đã giữ vào bộ"
              aria-label="Thêm mục đã giữ vào bộ"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRenameSheet(true)}
              className="p-1.5 text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] rounded-md transition press-xs cursor-pointer"
              title="Đổi tên"
              aria-label="Đổi tên bộ sưu tập"
            >
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-[#BA1A1A] hover:bg-[#FFDAD6] rounded-md transition press-xs cursor-pointer"
              title="Xóa bộ"
              aria-label="Xóa bộ sưu tập"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </div>
        }
      />

      {/* Collection Header Banner */}
      <div className="p-4 bg-[#FAF9F7] border-b border-[#3D4A5C]">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <span className="material-symbols-outlined text-[24px] text-[#3D4A5C] shrink-0">
            folder
          </span>
          <h1 className="type-headline-sm text-[#1B1B1B] break-words [overflow-wrap:anywhere] min-w-0 flex-1">
            {collection.name}
          </h1>
        </div>
        <p className="type-nano-code text-[#44474C]">
          GỒM {items.length} MỤC TRI THỨC
        </p>
      </div>

      <div className="p-4 flex-1">
        {items.length === 0 ? (
          <EmptyState
            title="Bộ này chưa có mục đã giữ"
            subtitle="Chọn các ghi chú, tệp hoặc liên kết từ thư viện để thêm vào bộ này."
            icon="folder_open"
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  tagMap={tagMap}
                  onOpen={(itemId) => navigate(`/items/${itemId}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Item Picker */}
      {id && (
        <ItemPicker
          isOpen={showItemPicker}
          onClose={() => setShowItemPicker(false)}
          collectionId={id}
          onAddItem={handleAddItem}
        />
      )}

      {/* Rename Sheet */}
      <NameSheet
        isOpen={showRenameSheet}
        onClose={() => setShowRenameSheet(false)}
        onSubmit={handleRename}
        initialValue={collection.name}
        title="Đổi tên bộ sưu tập"
      />

      {/* Delete Confirm */}
      <ConfirmSheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Xóa bộ sưu tập?"
        customMessage={`Bạn có chắc muốn xóa bộ sưu tập "${collection.name}"? Các mục tri thức bên trong sẽ không bị xóa và vẫn được giữ trong Thư viện.`}
        confirmLabel="Xóa bộ"
      />
    </div>
  );
};
