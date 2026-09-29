import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/shell/TopBar';
import { ItemCard } from '../components/list/ItemCard';
import { EmptyState } from '../components/list/EmptyState';
import { NameSheet } from '../components/sheets/NameSheet';
import { ConfirmSheet } from '../components/sheets/ConfirmSheet';
import { tagService } from '../services/TagService';
import { useBatchTags } from '../hooks/useBatchTags';
import { db } from '../db/database';
import type { Tag } from '../types/tag';
import type { Item } from '../types/item';
import type { QueryState } from '../types/query';

export const TagDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [showRenameSheet, setShowRenameSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tagQuery = useLiveQuery<QueryState<Tag>>(
    async () => {
      if (!id) return { status: 'notFound' };
      const result = await db.tags.get(id);
      return result ? { status: 'found', data: result } : { status: 'notFound' };
    },
    [id]
  );

  const items = useLiveQuery<Item[]>(
    async () => {
      if (!id) return [];
      const list = await db.items.where('tags').equals(id).toArray();
      const uniqueMap = new Map<string, Item>();
      for (const item of list) {
        uniqueMap.set(item.id, item);
      }
      return Array.from(uniqueMap.values());
    },
    [id]
  ) || [];

  const tagMap = useBatchTags(items);

  const queryState: QueryState<Tag> = tagQuery ?? { status: 'loading' };

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
        <p className="type-headline-xs text-[#BA1A1A]">Không tìm thấy thẻ</p>
        <button
          onClick={() => navigate('/tags')}
          className="mt-3 px-4 py-2 bg-[#3D4A5C] text-white rounded-lg text-xs font-mono font-bold shadow-hard-xs hover:bg-[#1B1B1B] transition cursor-pointer press-xs"
        >
          QUAY LẠI THẺ
        </button>
      </div>
    );
  }

  const tag = queryState.data;

  const handleRename = async (name: string) => {
    if (!id) return;
    await tagService.updateTag(id, name);
  };

  const handleDelete = async () => {
    if (!id) return;
    await tagService.deleteTag(id);
    navigate('/tags', { replace: true });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF] min-h-screen">
      <TopBar
        variant="detail"
        backLabel="Thẻ"
        onBack={() => navigate('/tags')}
        actions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowRenameSheet(true)}
              className="p-1.5 text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] rounded-md transition press-xs cursor-pointer"
              title="Đổi tên"
              aria-label="Đổi tên thẻ phân loại"
            >
              <span className="material-symbols-outlined text-[20px]">edit</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-[#BA1A1A] hover:bg-[#FFDAD6] rounded-md transition press-xs cursor-pointer"
              title="Xóa thẻ"
              aria-label="Xóa thẻ phân loại"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </div>
        }
      />

      {/* Header Banner */}
      <div className="p-4 bg-[#FAF9F7] border-b border-[#3D4A5C]">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <span className="material-symbols-outlined text-[22px] text-[#3D4A5C] shrink-0">tag</span>
          <h1 className="type-headline-sm text-[#1B1B1B] break-words [overflow-wrap:anywhere] min-w-0 flex-1 font-mono">
            #{tag.name}
          </h1>
        </div>
        <p className="type-nano-code text-[#44474C]">
          GẮN TRONG {items.length} MỤC TRI THỨC
        </p>
      </div>

      <div className="p-4 flex-1">
        {items.length === 0 ? (
          <EmptyState
            title="Chưa có mục nào gắn thẻ này"
            subtitle="Bạn có thể gán thẻ này khi lưu hoặc chỉnh sửa mục."
            icon="tag"
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

      {/* Rename Sheet */}
      <NameSheet
        isOpen={showRenameSheet}
        onClose={() => setShowRenameSheet(false)}
        onSubmit={handleRename}
        initialValue={tag.name}
        title="Đổi tên thẻ phân loại"
        label="Tên thẻ phân loại"
        placeholder="Nhập tên thẻ phân loại..."
        submitLabel="Lưu thay đổi"
      />

      {/* Delete Confirm */}
      <ConfirmSheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Xóa thẻ phân loại?"
        customMessage={`Bạn có chắc muốn xóa thẻ "#${tag.name}"? Thẻ này sẽ được gỡ khỏi ${items.length} mục tri thức liên quan, nhưng nội dung các mục vẫn được giữ nguyên trong Thư viện.`}
        confirmLabel="Xóa thẻ"
      />
    </div>
  );
};
