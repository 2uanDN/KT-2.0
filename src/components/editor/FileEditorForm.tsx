import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseEditorLayout } from './BaseEditorLayout';
import { InlineError } from '../feedback/InlineError';
import { fileService } from '../../services/FileService';
import { itemService } from '../../services/ItemService';
import type { FileItem, FileType, QueuedFileDraft, ItemType } from '../../types/item';
import type { CommonEditorMeta } from './types';

export interface FileEditorFormProps {
  initialItem?: FileItem;
  isEditing?: boolean;
  commonMeta: CommonEditorMeta;
  onCommonMetaChange: (updates: Partial<CommonEditorMeta>) => void;
  onTypeChange?: (type: ItemType) => void;
  conflictBanner?: React.ReactNode;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const FileEditorForm: React.FC<FileEditorFormProps> = ({
  initialItem,
  isEditing = false,
  commonMeta,
  onCommonMetaChange,
  onTypeChange,
  conflictBanner,
  onDirtyChange,
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File-specific state
  const [fileCaption, setFileCaption] = useState(initialItem?.caption || '');
  const [fileQueue, setFileQueue] = useState<QueuedFileDraft[]>(() => {
    if (initialItem) {
      if (initialItem.files && initialItem.files.length > 0) {
        return initialItem.files.map((sf) => ({
          id: sf.id,
          storedFile: sf,
          originalFilename: sf.originalFilename,
          fileSizeBytes: sf.fileSizeBytes,
          fileType: sf.fileType,
          mimeType: sf.mimeType,
          isImage: fileService.isImage(sf.originalFilename, sf.mimeType),
          isThumbnail: initialItem.thumbnailFileId
            ? initialItem.thumbnailFileId === sf.id
            : Boolean(sf.isThumbnail),
        }));
      } else if (initialItem.opfsPath) {
        const isImg = fileService.isImage(initialItem.originalFilename, initialItem.mimeType);
        return [
          {
            id: initialItem.id,
            originalFilename: initialItem.originalFilename,
            fileSizeBytes: initialItem.fileSizeBytes,
            fileType: initialItem.fileType,
            mimeType: initialItem.mimeType,
            isImage: isImg,
            isThumbnail: Boolean(initialItem.thumbnailBlobUrl),
          },
        ];
      }
    }
    return [];
  });

  const [fileError, setFileError] = useState<string | null>(null);
  const [openMenuFileId, setOpenMenuFileId] = useState<string | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isDirty = Boolean(
    commonMeta.title !== (initialItem?.title || '') ||
    fileCaption !== (initialItem?.caption || '') ||
    (isEditing
      ? fileQueue.length !== (initialItem?.files?.length || (initialItem?.opfsPath ? 1 : 0)) ||
        fileQueue.some((qf) => !qf.storedFile)
      : fileQueue.length > 0) ||
    commonMeta.tags.join(',') !== (initialItem?.tags || []).join(',') ||
    commonMeta.collections.join(',') !== (initialItem?.collections || []).join(',') ||
    commonMeta.isPinned !== (initialItem?.isPinned || false) ||
    commonMeta.keepLong !== (initialItem ? initialItem.status === 'saved' : true)
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const canSubmit = !isSubmitting && fileQueue.length > 0;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(e.target.files || []);
    if (incomingFiles.length === 0) return;

    setFileError(null);
    const newQueueItems: QueuedFileDraft[] = [];
    const errors: string[] = [];

    for (const file of incomingFiles) {
      const validation = fileService.validateFile(file);
      if (!validation.ok) {
        errors.push(validation.error || `Tệp ${file.name} không hợp lệ`);
        continue;
      }

      const isImg = validation.isImage ?? fileService.isImage(file.name, file.type);
      const detectedType: FileType = validation.detectedType || (isImg ? 'image' : 'pdf');

      newQueueItems.push({
        id: crypto.randomUUID(),
        file,
        originalFilename: file.name,
        fileSizeBytes: file.size,
        fileType: detectedType,
        mimeType: file.type || 'application/octet-stream',
        isImage: isImg,
        isThumbnail: false,
      });
    }

    if (errors.length > 0) {
      setFileError(errors.join('. '));
    }

    if (newQueueItems.length > 0) {
      // Pure computation of auto title outside the state updater
      const needsTitleUpdate = !commonMeta.title;
      const firstItem = fileQueue.length > 0 ? fileQueue[0] : newQueueItems[0];
      const autoTitle = (needsTitleUpdate && firstItem)
        ? firstItem.originalFilename.replace(/\.[^/.]+$/, '')
        : null;

      setFileQueue((prev) => {
        let next = [...prev, ...newQueueItems];
        // Ensure default thumbnail is set to the first image file if none is chosen yet
        const hasThumb = next.some((item) => item.isThumbnail);
        if (!hasThumb) {
          const firstImageIdx = next.findIndex((item) => item.isImage);
          if (firstImageIdx !== -1) {
            next = next.map((item, idx) => ({
              ...item,
              isThumbnail: idx === firstImageIdx,
            }));
          }
        }
        return next;
      });

      if (autoTitle) {
        onCommonMetaChange({ title: autoTitle });
      }
    }

    // Reset input value so same files can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleThumbnail = (fileId: string) => {
    setFileQueue((prev) =>
      prev.map((item) => {
        if (item.id === fileId) {
          return { ...item, isThumbnail: !item.isThumbnail };
        }
        return { ...item, isThumbnail: false };
      })
    );
    setOpenMenuFileId(null);
  };

  const handleRemoveFile = (fileId: string) => {
    setFileQueue((prev) => {
      let next = prev.filter((item) => item.id !== fileId);
      // If no thumbnail remains selected, automatically default to first remaining image
      const hasThumb = next.some((item) => item.isThumbnail);
      if (!hasThumb) {
        const firstImageIdx = next.findIndex((item) => item.isImage);
        if (firstImageIdx !== -1) {
          next = next.map((item, idx) => ({
            ...item,
            isThumbnail: idx === firstImageIdx,
          }));
        }
      }
      return next;
    });
    setOpenMenuFileId(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (isEditing && initialItem) {
        const baseUpdates = {
          title: commonMeta.title.trim() || undefined,
          tags: commonMeta.tags,
          collections: commonMeta.collections,
          isPinned: commonMeta.isPinned,
          status: commonMeta.keepLong ? ('saved' as const) : ('inbox' as const),
          savedAt: commonMeta.keepLong ? initialItem.savedAt || Date.now() : null,
        };

        await itemService.updateFileItemWithQueue(
          initialItem.id,
          {
            ...baseUpdates,
            caption: fileCaption,
            displayName: commonMeta.title.trim() || undefined,
          },
          fileQueue
        );

        navigate(`/items/${initialItem.id}`, { replace: true });
      } else {
        await itemService.createItem(
          {
            type: 'file',
            title: commonMeta.title.trim() || undefined,
            tags: commonMeta.tags,
            collections: commonMeta.collections,
            isPinned: commonMeta.isPinned,
            fileQueue,
            displayName: commonMeta.title.trim() || undefined,
            caption: fileCaption,
          },
          commonMeta.keepLong
        );

        const destination = commonMeta.keepLong ? '/' : '/inbox';
        navigate(destination, { replace: true });
      }
    } catch (err: unknown) {
      console.error('Failed to save file item:', err);
      setFormError((err as Error)?.message || 'Không thể lưu tệp. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  };

  return (
    <BaseEditorLayout
      title={isEditing ? 'Chỉnh sửa tri thức' : 'Lưu tri thức mới'}
      selectedType="file"
      isEditing={isEditing}
      onTypeChange={onTypeChange}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      formError={formError}
      conflictBanner={conflictBanner}
      tags={commonMeta.tags}
      onTagsChange={(tags) => onCommonMetaChange({ tags })}
      collections={commonMeta.collections}
      onCollectionsChange={(collections) => onCommonMetaChange({ collections })}
      isPinned={commonMeta.isPinned}
      onPinChange={(isPinned) => onCommonMetaChange({ isPinned })}
      keepLong={commonMeta.keepLong}
      onKeepLongChange={(keepLong) => onCommonMetaChange({ keepLong })}
    >
      <div className="space-y-4">
        {/* File Queue Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <label className="type-label-code-bold text-[#3D4A5C]">
                Danh sách tệp trong hàng chờ ({fileQueue.length})
              </label>
              {fileQueue.length > 0 && (
                <span className="type-nano-code font-mono text-[#75777D]">
                  · Tổng: {formatFileSize(fileQueue.reduce((acc, f) => acc + (f.fileSizeBytes || 0), 0))}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#3D4A5C] hover:text-[#1B1B1B] bg-[#FAF9F7] hover:bg-[#FFFFFF] px-2.5 py-1 rounded-md transition cursor-pointer border border-[#3D4A5C] shadow-hard-xs press-xs"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              <span>THÊM TỆP</span>
            </button>
          </div>

          {/* Hidden multi-file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/*,.jpg,.jpeg,.png,.webp,.svg,.bmp,.tiff,.tif,.heic,.heif,.md,.markdown,text/markdown,text/plain"
            onChange={handleFilesSelected}
            className="hidden"
          />

          {/* Drop / Selection Zone when queue is empty */}
          {fileQueue.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#3D4A5C] rounded-lg p-6 text-center bg-[#FAF9F7] hover:bg-[#FFFFFF] shadow-hard-xs transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[36px] text-[#3D4A5C] mb-1.5">
                upload_file
              </span>
              <p className="type-headline-xs text-[#1B1B1B]">
                Nhấn để chọn tệp (hỗ trợ chọn nhiều tệp)
              </p>
              <p className="type-nano-code text-[#44474C] mt-1">
                PDF, Hình ảnh (JPG, PNG, WEBP, SVG, BMP, TIFF, HEIC...), Markdown • Tối đa 50MB/tệp
              </p>
            </div>
          ) : (
            /* File Queue List */
            <div className="space-y-2">
              <div className="divide-y divide-[#3D4A5C]/20 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg overflow-visible shadow-hard-xs">
                {fileQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between gap-2.5 hover:bg-white transition relative"
                  >
                    {/* File Icon & Info */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 border ${
                          item.isThumbnail
                            ? 'bg-[#3D4A5C] text-white border-[#1B1B1B]'
                            : item.isImage
                            ? 'bg-[#A8C5B8] text-[#1B1B1B] border-[#3D4A5C]/30'
                            : item.fileType === 'pdf'
                            ? 'bg-[#D4A5A5] text-[#1B1B1B] border-[#3D4A5C]/30'
                            : 'bg-[#E0DFDE] text-[#1B1B1B] border-[#3D4A5C]/30'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {item.isImage ? 'image' : item.fileType === 'pdf' ? 'picture_as_pdf' : 'description'}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <p className="type-code-sm font-bold text-[#1B1B1B] truncate max-w-full min-w-0">
                            {item.originalFilename}
                          </p>
                          {item.isThumbnail && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-xs bg-[#3D4A5C] text-white type-nano-code font-bold shrink-0">
                              THUMBNAIL
                            </span>
                          )}
                        </div>
                        <p className="type-nano-code text-[#44474C] mt-0.5">
                          #{idx + 1} · {formatFileSize(item.fileSizeBytes)} · {item.fileType.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {/* Actions Menu (•••) */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuFileId(openMenuFileId === item.id ? null : item.id)
                        }
                        className="w-8 h-8 rounded-md flex items-center justify-center text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] transition cursor-pointer"
                        aria-label="Tùy chọn tệp"
                      >
                        <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                      </button>

                      {/* Dropdown Menu */}
                      {openMenuFileId === item.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setOpenMenuFileId(null)}
                            aria-hidden="true"
                          />
                          <div className="absolute right-0 top-full mt-1 z-30 w-52 bg-white border-2 border-[#3D4A5C] rounded-lg shadow-hard-lg py-1 text-xs">
                            {/* Thumbnail action (only for image files) */}
                            {item.isImage && (
                              <button
                                type="button"
                                onClick={() => handleToggleThumbnail(item.id)}
                                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FAF9F7] text-[#1B1B1B] font-medium cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">
                                  {item.isThumbnail ? 'hide_image' : 'photo_size_select_actual'}
                                </span>
                                <span>
                                  {item.isThumbnail ? 'Bỏ chọn thumbnail' : 'Chọn làm thumbnail'}
                                </span>
                              </button>
                            )}

                            {/* Delete action */}
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(item.id)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#FFDAD6] text-[#BA1A1A] font-medium cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                              <span>Xóa khỏi danh sách</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fileError && <InlineError message={fileError} className="mt-2" />}
        </div>

        {/* Display Title */}
        <div>
          <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
            Tên hiển thị tri thức
          </label>
          <input
            type="text"
            value={commonMeta.title}
            onChange={(e) => onCommonMetaChange({ title: e.target.value })}
            placeholder="Tên gợi nhớ cho bộ tệp này..."
            className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
          />
        </div>

        {/* Caption */}
        <div>
          <label className="type-label-code-bold text-[#3D4A5C] mb-1 block">
            Chú thích (Vì sao lưu tệp này?)
          </label>
          <textarea
            value={fileCaption}
            onChange={(e) => setFileCaption(e.target.value)}
            placeholder="Ghi chú thêm về nội dung hoặc mục đích của tệp..."
            rows={3}
            className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
          />
        </div>
      </div>
    </BaseEditorLayout>
  );
};
