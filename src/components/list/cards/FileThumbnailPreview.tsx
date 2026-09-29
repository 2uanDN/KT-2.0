import React from 'react';
import { useOPFSUrl } from '../../../hooks/useOPFSUrl';

interface FileThumbnailPreviewProps {
  thumbnailPath: string;
  title: string;
  imageCount: number;
  onViewImage: () => void;
}

export const FileThumbnailPreview: React.FC<FileThumbnailPreviewProps> = ({
  thumbnailPath,
  title,
  imageCount,
  onViewImage,
}) => {
  const { url, loading } = useOPFSUrl(thumbnailPath);

  if (loading || !url) {
    return (
      <div className="w-full h-40 bg-[#FAF9F7] flex items-center justify-center border-b border-[#3D4A5C]/20 animate-pulse">
        <span className="w-5 h-5 border-2 border-[#3D4A5C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-44 sm:h-48 bg-[#F3F3F3] overflow-hidden flex items-center justify-center border-b border-[#3D4A5C]/20 group-hover:brightness-[1.02] transition">
      {/* Soft blurred ambient backdrop */}
      <img
        src={url}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover blur-xl opacity-20 scale-125 pointer-events-none select-none"
      />
      {/* High-res uncropped main image */}
      <img
        src={url}
        alt={title}
        className="relative z-10 max-h-full max-w-full w-auto h-auto object-contain p-2 transition-transform duration-200 ease-out group-hover:scale-[1.02]"
        loading="lazy"
      />

      {/* Floating 'Xem ảnh' button directly on thumbnail for quick instant access */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onViewImage();
        }}
        className="absolute bottom-2 right-2 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1B1B1B]/90 hover:bg-[#1B1B1B] active:scale-95 text-white text-[11px] font-mono font-bold shadow-hard-xs border border-white/20 transition cursor-pointer"
        title="Xem ảnh gốc hoàn chỉnh"
        aria-label="Xem ảnh gốc"
      >
        <span className="material-symbols-outlined text-[15px]">visibility</span>
        <span>XEM ẢNH</span>
        {imageCount > 1 && (
          <span className="bg-white/30 px-1 py-0.2 rounded text-[10px] font-mono font-bold">
            {imageCount}
          </span>
        )}
      </button>
    </div>
  );
};
