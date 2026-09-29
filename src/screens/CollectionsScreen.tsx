import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/shell/TopBar';
import { EmptyState } from '../components/list/EmptyState';
import { NameSheet } from '../components/sheets/NameSheet';
import { ConfirmSheet } from '../components/sheets/ConfirmSheet';
import { collectionService } from '../services/CollectionService';
import { db } from '../db/database';
import type { Collection } from '../types/collection';

export const CollectionsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [renamingCollection, setRenamingCollection] = useState<Collection | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);

  // Load collections
  const rawCollections = useLiveQuery(
    () => db.collections.orderBy('createdAt').reverse().toArray(),
    []
  ) || [];

  // Deduplicate display collections using centralized collection service logic
  const collections = useMemo(
    () => collectionService.deduplicateCollections(rawCollections),
    [rawCollections]
  );

  // Load item counts for each collection using multi-entry index without full table scan
  const itemCounts = useLiveQuery(async () => {
    const cols = await db.collections.toArray();
    const map: Record<string, number> = {};
    await Promise.all(
      cols.map(async (col) => {
        map[col.id] = await db.items.where('collections').equals(col.id).count();
      })
    );
    return map;
  }, []) || {};

  const handleCreateCollection = async (name: string) => {
    await collectionService.createCollection(name);
  };

  const handleRenameCollection = async (name: string) => {
    if (!renamingCollection) return;
    await collectionService.updateCollection(renamingCollection.id, name);
    setRenamingCollection(null);
  };

  const handleDeleteCollection = async () => {
    if (!deletingCollection) return;
    await collectionService.deleteCollection(deletingCollection.id);
    setDeletingCollection(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF]">
      <TopBar
        variant="list"
        title="Bộ sưu tập"
        onSearchClick={() => navigate('/search')}
      />

      {/* Sub-bar for Collections action */}
      <div className="flex items-center justify-between gap-2 py-2.5 px-4 bg-[#FAF9F7] border-b border-[#3D4A5C]/20">
        <span className="type-label-code-bold text-[#3D4A5C]">
          {collections.length > 0 ? `${collections.length} BỘ SƯU TẬP` : 'BỘ SƯU TẬP'}
        </span>
        <button
          type="button"
          onClick={() => setShowCreateSheet(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white rounded-lg text-xs font-mono font-bold shadow-hard-xs hover:shadow-hard-sm border border-[#1B1B1B] transition cursor-pointer press-xs"
        >
          <span className="material-symbols-outlined text-[16px]">create_new_folder</span>
          <span>TẠO BỘ</span>
        </button>
      </div>

      <div className="p-4 flex-1">
        {collections.length === 0 ? (
          <EmptyState
            title="Chưa có bộ sưu tập"
            subtitle="Gom các ghi chú, tệp và liên kết có liên quan thành các chủ đề riêng biệt."
            icon="folder_open"
            action={{
              label: 'Tạo bộ sưu tập',
              onClick: () => setShowCreateSheet(true),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {collections.map((col) => {
              const count = itemCounts[col.id] || 0;
              return (
                <div
                  key={col.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/collections/${col.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/collections/${col.id}`)}
                  className="group relative bg-[#FAF9F7] p-3.5 rounded-lg border border-[#3D4A5C] shadow-hard-md hover:border-[#1B1B1B] hover:shadow-hard-sm transition-all duration-150 text-left cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded bg-[#FFFFFF] border border-[#3D4A5C] text-[#3D4A5C] shadow-hard-xs flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">folder</span>
                      </div>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setRenamingCollection(col)}
                          className="p-1 text-[#75777D] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] rounded cursor-pointer press-xs"
                          title="Đổi tên"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCollection(col)}
                          className="p-1 text-[#75777D] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] rounded cursor-pointer press-xs"
                          title="Xóa bộ sưu tập"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>

                    <h3 className="type-headline-xs text-[#1B1B1B] group-hover:text-[#3D4A5C] truncate mb-1">
                      {col.name}
                    </h3>
                  </div>

                  <div className="pt-2 border-t border-[#3D4A5C]/20 flex items-center justify-between type-nano-code text-[#44474C]">
                    <span className="font-bold">{count} MỤC</span>
                    <span>
                      {new Date(col.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Sheet */}
      <NameSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onSubmit={handleCreateCollection}
        title="Tạo bộ sưu tập mới"
        placeholder="Tên bộ sưu tập (ví dụ: Nghiên cứu AI, Dự án X...)"
        submitLabel="Tạo bộ"
      />

      {/* Rename Sheet */}
      <NameSheet
        isOpen={Boolean(renamingCollection)}
        onClose={() => setRenamingCollection(null)}
        onSubmit={handleRenameCollection}
        initialValue={renamingCollection?.name || ''}
        title="Đổi tên bộ sưu tập"
        submitLabel="Lưu thay đổi"
      />

      {/* Delete Collection Confirm */}
      <ConfirmSheet
        isOpen={Boolean(deletingCollection)}
        onClose={() => setDeletingCollection(null)}
        onConfirm={handleDeleteCollection}
        title="Xóa bộ sưu tập?"
        customMessage={`Bạn có chắc muốn xóa bộ sưu tập "${deletingCollection?.name}"? Các mục tri thức bên trong sẽ không bị xóa và vẫn được giữ trong Thư viện.`}
        confirmLabel="Xóa bộ"
      />
    </div>
  );
};
