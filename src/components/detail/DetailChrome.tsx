import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../shell/TopBar';
import { ConfirmSheet } from '../sheets/ConfirmSheet';
import { itemService } from '../../services/ItemService';
import { toastStore } from '../../store/toastStore';
import type { Item, FileItem } from '../../types/item';

interface DetailChromeProps {
  item: Item;
  backLabel?: string;
  onBack?: () => void;
}

export const DetailChrome: React.FC<DetailChromeProps> = ({
  item,
  backLabel = 'Quay lại',
  onBack,
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleOpenDelete = () => {
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await itemService.deleteItem(item.id);
      navigate(item.status === 'inbox' ? '/inbox' : '/', { replace: true });
    } catch (err) {
      console.error('Failed to delete item:', err);
      toastStore.show('Không thể xóa mục. Vui lòng thử lại.');
    }
  };

  const handleTogglePin = async () => {
    try {
      await itemService.togglePin(item.id);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      toastStore.show('Không thể cập nhật trạng thái ghim');
    }
  };

  const handleToggleMove = async () => {
    setShowMenu(false);
    try {
      await itemService.moveItem(
        item.id,
        item.status === 'saved' ? 'inbox' : 'saved'
      );
    } catch (err) {
      console.error('Failed to move item:', err);
      toastStore.show('Không thể di chuyển mục');
    }
  };

  const actions = (
    <div className="flex items-center gap-1">
      {/* Edit button */}
      <button
        type="button"
        onClick={() => navigate(`/items/${item.id}/edit`)}
        className="p-1.5 text-[#3D4A5C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] rounded-md transition cursor-pointer press-xs"
        title="Chỉnh sửa"
        aria-label="Chỉnh sửa mục"
      >
        <span className="material-symbols-outlined text-[20px]">edit</span>
      </button>

      {/* Pin button */}
      <button
        type="button"
        onClick={handleTogglePin}
        className={`p-1.5 rounded-md transition cursor-pointer press-xs ${
          item.isPinned
            ? 'text-white bg-[#3D4A5C] border border-[#1B1B1B] shadow-hard-xs'
            : 'text-[#75777D] hover:bg-[#E8E8E8]'
        }`}
        title={item.isPinned ? 'Bỏ ghim' : 'Ghim'}
        aria-label={item.isPinned ? 'Bỏ ghim mục' : 'Ghim mục'}
      >
        <span className="material-symbols-outlined text-[20px]">push_pin</span>
      </button>

      {/* More menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] rounded-md cursor-pointer press-xs"
          aria-label="Tùy chọn khác"
        >
          <span className="material-symbols-outlined text-[20px]">more_vert</span>
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowMenu(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 top-full mt-1 z-30 w-52 bg-white border-2 border-[#3D4A5C] rounded-lg shadow-hard-lg py-1 text-xs">
              <button
                type="button"
                onClick={handleToggleMove}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF9F7] text-[#1B1B1B] font-medium cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">
                  {item.status === 'saved' ? 'inbox' : 'bookmark_added'}
                </span>
                <span>
                  {item.status === 'saved' ? 'Chuyển về Hộp chờ' : 'Chuyển vào Thư viện'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleOpenDelete}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FFDAD6] text-[#BA1A1A] font-medium cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Xóa mục này</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const getTypeAccent = (targetItem: Item) => {
    switch (targetItem.type) {
      case 'note':
        return '#E8D4B8';
      case 'file': {
        const fi = targetItem as FileItem;
        if (fi.fileType === 'image') return '#A8C5B8';
        if (fi.fileType === 'markdown') return '#B9B08A';
        return '#D4A5A5';
      }
      case 'link':
        return '#B9B08A';
    }
  };

  return (
    <>
      <div
        className="h-1.5 w-full shrink-0 sticky top-0 z-40 border-b border-[#3D4A5C]/20"
        style={{ backgroundColor: getTypeAccent(item) }}
      />
      <TopBar
        variant="detail"
        backLabel={backLabel}
        onBack={onBack}
        actions={actions}
      />

      <ConfirmSheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        item={item}
      />
    </>
  );
};
