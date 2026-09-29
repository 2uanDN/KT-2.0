import React, { useState, useCallback, useMemo } from 'react';
import type { FileItem, StoredFile } from '../../../types/item';
import type { Tag } from '../../../types/tag';
import { BaseCard } from './BaseCard';
import type { CardVariant } from './cardUtils';
import { FileThumbnailPreview } from './FileThumbnailPreview';
import { ImageViewerModal } from '../../viewer/ImageViewerModal';
import { fileService, formatFileSize, getTotalFileSize, getFileCategoryTag } from '../../../services/FileService';

export interface FileCardProps {
  item: FileItem;
  variant?: CardVariant;
  onOpen: (id: string) => void;
  tags?: Tag[];
}

export const FileCard: React.FC<FileCardProps> = ({
  item,
  variant = 'library',
  onOpen,
  tags,
}) => {
  const [showImageViewer, setShowImageViewer] = useState(false);

  const handleOpenImageViewer = useCallback(() => {
    setShowImageViewer(true);
  }, []);

  const handleCloseImageViewer = useCallback(() => {
    setShowImageViewer(false);
  }, []);

  const imageFiles = useMemo<StoredFile[]>(() => {
    const list: StoredFile[] = [];

    if (item.files && item.files.length > 0) {
      for (const f of item.files) {
        if (f.fileType === 'image' || fileService.isImage(f.originalFilename, f.mimeType)) {
          list.push(f);
        }
      }
    } else if (item.opfsPath && (item.fileType === 'image' || fileService.isImage(item.originalFilename, item.mimeType))) {
      list.push({
        id: item.id,
        originalFilename: item.originalFilename,
        fileSizeBytes: item.fileSizeBytes,
        opfsPath: item.opfsPath,
        mimeType: item.mimeType,
        fileType: item.fileType,
        isThumbnail: Boolean(item.thumbnailBlobUrl),
      });
    }

    return list;
  }, [item]);

  const hasImageFiles = imageFiles.length > 0;
  const hasThumbnail = Boolean(item.thumbnailBlobUrl);

  const { totalFileBytes, fileCategoryTag } = useMemo(() => {
    const total = getTotalFileSize(item);
    const tag = getFileCategoryTag(item);
    return { totalFileBytes: total, fileCategoryTag: tag };
  }, [item]);

  const fileListInfo = useMemo(() => {
    const files =
      item.files && item.files.length > 0
        ? item.files.map((f) => ({
            id: f.id,
            name: f.originalFilename,
            type: f.fileType,
            size: f.fileSizeBytes,
            isThumbnail: item.thumbnailFileId ? item.thumbnailFileId === f.id : Boolean(f.isThumbnail),
          }))
        : item.originalFilename
        ? [
            {
              id: item.id,
              name: item.originalFilename,
              type: item.fileType,
              size: item.fileSizeBytes,
              isThumbnail: Boolean(item.thumbnailBlobUrl),
            },
          ]
        : [];

    const totalCount = files.length;
    const displayedFiles = files.slice(0, 3);
    const remainingCount = totalCount > 3 ? totalCount - 3 : 0;

    return {
      files,
      displayedFiles,
      remainingCount,
      totalCount,
    };
  }, [item]);

  const customTypeLabel = useMemo(
    () => (
      <>
        Tệp tài liệu · {fileCategoryTag} · {formatFileSize(totalFileBytes)}
      </>
    ),
    [fileCategoryTag, totalFileBytes]
  );

  const headerBadges = useMemo(() => {
    if (fileListInfo.totalCount <= 1) return null;
    return (
      <span
        className="px-1.5 py-0.5 rounded-xs type-nano-code font-bold bg-[#E8E8E8] text-[#3D4A5C] border border-[#3D4A5C]/30 shrink-0"
        title={`${fileListInfo.totalCount} tệp trong bộ tri thức`}
      >
        {fileListInfo.totalCount} TỆP
      </span>
    );
  }, [fileListInfo.totalCount]);

  const mediaSlot = useMemo(() => {
    if (!hasThumbnail || !item.thumbnailBlobUrl) return null;
    return (
      <FileThumbnailPreview
        thumbnailPath={item.thumbnailBlobUrl}
        title={item.title}
        imageCount={imageFiles.length}
        onViewImage={handleOpenImageViewer}
      />
    );
  }, [hasThumbnail, item.thumbnailBlobUrl, item.title, imageFiles.length, handleOpenImageViewer]);

  return (
    <>
      <BaseCard
        item={item}
        variant={variant}
        onOpen={onOpen}
        tags={tags}
        customTypeLabel={customTypeLabel}
        headerBadges={headerBadges}
        contextLine={item.caption || ''}
        mediaSlot={mediaSlot}
      >
        {/* File Attachments List: Each file on its own line */}
        {fileListInfo.totalCount > 0 && (
          <div className="space-y-1.5 mb-2.5">
            {fileListInfo.displayedFiles.map((file, idx) => (
              <div
                key={file.id || idx}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm bg-[#FFFFFF] border border-[#3D4A5C]/20 type-code-sm text-[#1B1B1B] max-w-full min-w-0 shadow-xs"
              >
                <span className="material-symbols-outlined text-[15px] shrink-0 text-[#3D4A5C]">
                  {file.type === 'image'
                    ? 'image'
                    : file.type === 'pdf'
                    ? 'picture_as_pdf'
                    : file.type === 'markdown'
                    ? 'description'
                    : 'draft'}
                </span>
                <span
                  className="truncate min-w-0 flex-1 font-mono text-[11px] text-[#1B1B1B] font-medium"
                  title={file.name}
                >
                  {file.name}
                </span>
                <span className="type-nano-code text-[#75777D] font-mono shrink-0">
                  {formatFileSize(file.size)}
                </span>
                {file.isThumbnail && (
                  <span className="px-1.5 py-0.5 rounded-xs bg-[#3D4A5C] text-white text-[9px] font-mono font-bold shrink-0">
                    THUMBNAIL
                  </span>
                )}
              </div>
            ))}

            {fileListInfo.remainingCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#FFFFFF] border border-dashed border-[#3D4A5C]/40 text-[#3D4A5C]">
                <span className="material-symbols-outlined text-[14px] shrink-0">
                  more_horiz
                </span>
                <span className="type-micro-code font-bold">
                  +{fileListInfo.remainingCount} tệp khác ({fileListInfo.totalCount} tệp trong bộ)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Nút 'Xem ảnh' nếu có image và không có thumbnail trên cùng */}
        {hasImageFiles && !hasThumbnail && (
          <div className="mb-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenImageViewer();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#3D4A5C] hover:bg-[#1B1B1B] active:scale-95 text-white text-xs font-mono font-bold shadow-hard-xs transition cursor-pointer border border-[#1B1B1B]"
              title="Xem ảnh gốc hoàn chỉnh"
            >
              <span className="material-symbols-outlined text-[15px]">visibility</span>
              <span>XEM ẢNH</span>
              {imageFiles.length > 1 && (
                <span className="bg-white/20 px-1 py-0.2 rounded-xs text-[10px] font-mono font-bold">
                  {imageFiles.length}
                </span>
              )}
            </button>
          </div>
        )}
      </BaseCard>

      {/* Full Original Image Viewer Modal */}
      {hasImageFiles && (
        <ImageViewerModal
          isOpen={showImageViewer}
          onClose={handleCloseImageViewer}
          images={imageFiles}
          initialImageId={item.thumbnailFileId}
          itemTitle={item.title}
        />
      )}
    </>
  );
};
