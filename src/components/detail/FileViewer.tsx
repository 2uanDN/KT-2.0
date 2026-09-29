import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOPFSUrl } from '../../hooks/useOPFSUrl';
import { fileService, formatFileSize, getTotalFileSize } from '../../services/FileService';
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer';
import { ImageViewerModal } from '../viewer/ImageViewerModal';
import { ErrorBoundary } from '../feedback/ErrorBoundary';
import type { FileItem, StoredFile } from '../../types/item';

interface FileViewerProps {
  item: FileItem;
}

export const FileViewer: React.FC<FileViewerProps> = ({ item }) => {
  const navigate = useNavigate();
  const [showImageViewer, setShowImageViewer] = useState(false);

  const handleOpenImageViewer = useCallback(() => {
    setShowImageViewer(true);
  }, []);

  const handleCloseImageViewer = useCallback(() => {
    setShowImageViewer(false);
  }, []);

  // Normalize files array
  const filesList: StoredFile[] = useMemo(() => {
    if (item.files && item.files.length > 0) {
      return item.files;
    }
    if (item.opfsPath) {
      return [
        {
          id: item.id,
          opfsPath: item.opfsPath,
          originalFilename: item.originalFilename,
          fileSizeBytes: item.fileSizeBytes,
          fileType: item.fileType,
          mimeType: item.mimeType,
          isThumbnail: Boolean(item.thumbnailBlobUrl),
        },
      ];
    }
    return [];
  }, [item]);

  const totalSize = useMemo(() => {
    return getTotalFileSize(item);
  }, [item]);

  // Extract all image files in this item
  const imageFiles: StoredFile[] = useMemo(() => {
    return filesList.filter(
      (f) => f.fileType === 'image' || fileService.isImage(f.originalFilename, f.mimeType)
    );
  }, [filesList]);

  const [activeFileId, setActiveFileId] = useState<string>(
    filesList[0]?.id || item.id
  );

  useEffect(() => {
    if (filesList.length > 0 && !filesList.some((f) => f.id === activeFileId)) {
      setActiveFileId(filesList[0].id);
    }
  }, [filesList, activeFileId]);

  const activeFile = filesList.find((f) => f.id === activeFileId) || filesList[0];

  const { url, loading, error } = useOPFSUrl(activeFile?.opfsPath);
  const [markdownText, setMarkdownText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (activeFile?.fileType === 'markdown' && activeFile?.opfsPath) {
      fileService
        .readText(activeFile.opfsPath)
        .then((text) => {
          if (active) {
            setMarkdownText(text);
          }
        })
        .catch((err) => {
          if (active) {
            console.error('Failed to read markdown file content:', err);
            setMarkdownText(null);
          }
        });
    } else {
      setMarkdownText(null);
    }

    return () => {
      active = false;
    };
  }, [activeFile]);

  const filesCount = filesList.length > 0 ? filesList.length : 1;

  return (
    <div className="space-y-4">
      {/* 1. File Header Block: N TỆP TRONG BỘ TRI THỨC */}
      <div className="bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] p-4 shadow-hard-md">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 type-label-code-bold text-[#3D4A5C] mb-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">folder_open</span>
                <span>{filesCount} TỆP TRONG BỘ TRI THỨC</span>
              </div>
              <span className="text-[#3D4A5C]/40">·</span>
              <span className="type-nano-code font-mono text-[#75777D] font-normal">
                TỔNG: {formatFileSize(totalSize)}
              </span>
            </div>
            <h1 className="type-headline-md text-[#1B1B1B] break-words [overflow-wrap:anywhere] leading-snug">
              {item.title}
            </h1>
          </div>
        </div>

        {/* Multi-file selector pills if > 1 file */}
        {filesList.length > 1 && (
          <div className="mt-3 pt-3 border-t border-[#3D4A5C]/20">
            <p className="type-label-code-bold text-[#3D4A5C] mb-2">
              DANH SÁCH TỆP ĐÍNH KÈM ({filesList.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filesList.map((f, idx) => {
                const isActive = f.id === activeFileId;
                const isThumb = item.thumbnailFileId === f.id || Boolean(f.isThumbnail);
                return (
                  <div
                    key={f.id}
                    onClick={() => setActiveFileId(f.id)}
                    className={`p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 cursor-pointer transition ${
                      isActive
                        ? 'bg-[#3D4A5C] text-white border-[#1B1B1B] shadow-hard-xs'
                        : 'bg-[#FFFFFF] hover:bg-[#FAF9F7] text-[#1B1B1B] border-[#3D4A5C]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-[18px] shrink-0">
                        {f.fileType === 'image'
                          ? 'image'
                          : f.fileType === 'pdf'
                          ? 'picture_as_pdf'
                          : 'description'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="type-code-sm font-bold truncate leading-tight break-all">
                          {f.originalFilename}
                        </p>
                        <p
                          className={`type-nano-code mt-0.5 ${
                            isActive ? 'text-[#D6E3FA]' : 'text-[#75777D]'
                          }`}
                        >
                          #{idx + 1} · {formatFileSize(f.fileSizeBytes)}
                        </p>
                      </div>
                    </div>

                    {isThumb && (
                      <span
                        className={`px-1.5 py-0.5 rounded-xs type-nano-code font-bold shrink-0 ${
                          isActive
                            ? 'bg-white text-[#3D4A5C]'
                            : 'bg-[#3D4A5C] text-white'
                        }`}
                        title="Ảnh đại diện của mục"
                      >
                        THUMB
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Viewer Area for Active File: ĐANG XEM */}
      {activeFile && (
        <ErrorBoundary
          resetKeys={[activeFile.id, activeFile.opfsPath]}
          fallback={(error, reset) => (
            <div className="bg-[#FFFFFF] rounded-lg border border-[#3D4A5C] p-6 text-center shadow-hard-md">
              <span className="material-symbols-outlined text-[36px] text-[#BA1A1A] mb-2">
                broken_image
              </span>
              <h3 className="type-headline-sm font-bold text-[#1B1B1B] mb-1">
                Lỗi hiển thị tệp: {activeFile.originalFilename}
              </h3>
              <p className="type-body-sm text-[#44474C] text-xs mb-3">
                Không thể kết xuất bản xem trước của tệp này ({error.message}). Tệp vẫn được lưu an toàn trong thiết bị.
              </p>
              <button
                type="button"
                onClick={reset}
                className="px-3 py-1 bg-[#3D4A5C] text-white rounded text-xs font-mono font-bold hover:bg-[#263345] transition cursor-pointer"
              >
                THỬ LẠI
              </button>
            </div>
          )}
        >
          <div className="bg-[#FFFFFF] rounded-lg border border-[#3D4A5C] overflow-hidden min-h-[260px] flex flex-col justify-center items-center shadow-hard-md">
            {/* Active File Banner */}
            <div className="w-full px-4 py-2 bg-[#FAF9F7] border-b border-[#3D4A5C]/20 flex items-center justify-between text-xs font-mono text-[#3D4A5C] gap-2">
              <span className="truncate min-w-0 flex-1 font-bold">
                ĐANG XEM: {activeFile.originalFilename}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="shrink-0 type-nano-code">{formatFileSize(activeFile.fileSizeBytes)}</span>
              </div>
            </div>

            {loading && (
              <div className="py-12 text-center text-xs font-mono text-[#75777D]">
                <span className="inline-block w-6 h-6 border-2 border-[#3D4A5C] border-t-transparent rounded-full animate-spin mb-2" />
                <p>Đang tải tệp từ bộ nhớ thiết bị...</p>
              </div>
            )}

            {error && (
              <div className="p-6 text-center text-xs text-[#BA1A1A]">
                <span className="material-symbols-outlined text-[32px] text-[#BA1A1A] mb-1">
                  broken_image
                </span>
                <p className="font-bold">{error}</p>
                <p className="text-[#75777D] mt-1">
                  Không thể hiển thị bản xem trước của tệp này hoặc định dạng chưa được hỗ trợ.
                </p>
              </div>
            )}

            {!loading && !error && url && (
              <>
                {/* IMAGE VIEWER */}
                {activeFile.fileType === 'image' && (
                  <div
                    className="p-2 w-full flex justify-center bg-[#1B1B1B] cursor-pointer group relative"
                    onClick={handleOpenImageViewer}
                    title="Bấm để xem ảnh gốc toàn màn hình"
                  >
                    <img
                      src={url}
                      alt={activeFile.originalFilename}
                      className="max-h-[500px] w-auto max-w-full object-contain rounded transition group-hover:opacity-95"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition pointer-events-none">
                      <span className="px-3 py-1.5 bg-[#3D4A5C] text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-hard-sm border border-white/20">
                        <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                        XEM TOÀN MÀN HÌNH
                      </span>
                    </div>
                  </div>
                )}

                {/* PDF VIEWER */}
                {activeFile.fileType === 'pdf' && (
                  <div className="w-full h-[540px] flex flex-col">
                    <iframe
                      src={url}
                      title={activeFile.originalFilename}
                      className="w-full flex-1 border-0"
                    />
                  </div>
                )}

                {/* MARKDOWN VIEWER */}
                {activeFile.fileType === 'markdown' && (
                  <div className="p-4 w-full text-left">
                    {markdownText !== null ? (
                      <MarkdownRenderer content={markdownText} />
                    ) : (
                      <p className="text-xs font-mono text-[#75777D]">Đang đọc văn bản...</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </ErrorBoundary>
      )}

      {/* 3. Phần Chú thích riêng biệt: Nằm ở giữa phần ĐANG XEM và THẺ */}
      <div className="bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] p-3.5 shadow-hard-md text-left">
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[#3D4A5C]/15">
          <div className="flex items-center gap-1.5 type-label-code-bold text-[#3D4A5C]">
            <span className="material-symbols-outlined text-[16px]">notes</span>
            <span>CHÚ THÍCH</span>
          </div>
          {item.caption ? (
            <span className="type-nano-code text-[#75777D] font-mono">
              Ghi chú tệp
            </span>
          ) : (
            <button
              type="button"
              onClick={() => navigate(`/items/${item.id}/edit`)}
              className="inline-flex items-center gap-0.5 type-nano-code font-bold text-[#3D4A5C] hover:text-[#1B1B1B] hover:underline cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">add</span>
              <span>Thêm chú thích</span>
            </button>
          )}
        </div>

        {item.caption ? (
          <p className="type-body-sm text-[#1B1B1B] whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
            {item.caption}
          </p>
        ) : (
          <p className="text-xs font-mono text-[#75777D] italic">
            Chưa có chú thích cho tệp này.
          </p>
        )}
      </div>

      {/* Full Original Image Viewer Modal */}
      {imageFiles.length > 0 && (
        <ImageViewerModal
          isOpen={showImageViewer}
          onClose={handleCloseImageViewer}
          images={imageFiles}
          initialImageId={activeFile?.fileType === 'image' ? activeFile.id : item.thumbnailFileId}
          itemTitle={item.title}
        />
      )}
    </div>
  );
};
