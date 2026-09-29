import React, { useState, useEffect, useCallback } from 'react';
import { useOPFSUrl } from '../../hooks/useOPFSUrl';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { StoredFile } from '../../types/item';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: StoredFile[];
  initialImageId?: string;
  itemTitle?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  images,
  initialImageId,
  itemTitle,
}) => {
  // Determine starting index: prefer initialImageId (or thumbnail), else 0
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const thumbnailRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  useBodyScrollLock(isOpen);

  // Sync initial index when modal opens or images/initialImageId change
  useEffect(() => {
    if (isOpen && images.length > 0) {
      if (initialImageId) {
        const foundIdx = images.findIndex((img) => img.id === initialImageId);
        if (foundIdx !== -1) {
          setCurrentIndex(foundIdx);
          setZoomLevel(1);
          return;
        }
      }
      // Check if any image is marked as thumbnail
      const thumbIdx = images.findIndex((img) => Boolean(img.isThumbnail));
      if (thumbIdx !== -1) {
        setCurrentIndex(thumbIdx);
      } else {
        setCurrentIndex(0);
      }
      setZoomLevel(1);
    }
  }, [isOpen, images, initialImageId]);

  // Synchronize thumbnailRefs array length with images.length and clean up when modal closes
  useEffect(() => {
    if (!isOpen) {
      thumbnailRefs.current = [];
    } else if (thumbnailRefs.current.length > images.length) {
      thumbnailRefs.current.length = images.length;
    }
  }, [isOpen, images.length]);

  // Keep active thumbnail centered in carousel
  useEffect(() => {
    if (!isOpen) return;
    const el = thumbnailRefs.current[currentIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [isOpen, currentIndex]);

  const currentImage = images[currentIndex] || images[0];
  const { url, loading, error } = useOPFSUrl(currentImage?.opfsPath);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const onCloseRef = React.useRef(onClose);
  const handlePrevRef = React.useRef(handlePrev);
  const handleNextRef = React.useRef(handleNext);

  React.useEffect(() => {
    onCloseRef.current = onClose;
    handlePrevRef.current = handlePrev;
    handleNextRef.current = handleNext;
  });

  // Keyboard navigation & Esc listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevRef.current();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextRef.current();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel((z) => Math.min(3, z + 0.25));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomLevel((z) => Math.max(0.5, z - 0.25));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0]?.clientX;
    if (touchEndX !== undefined) {
      const diff = touchEndX - touchStartX;
      // threshold: 50px
      if (diff > 50) {
        handlePrev();
      } else if (diff < -50) {
        handleNext();
      }
    }
    setTouchStartX(null);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh gốc"
      className="fixed inset-0 z-[110] flex flex-col bg-[#0f172a]/95 backdrop-blur-md text-white select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Top Header Bar */}
      <header className="h-14 sm:h-16 px-4 flex items-center justify-between border-b border-white/10 bg-black/40 shrink-0 z-20">
        {/* Left: Info & Index */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-[#bac7dd]">
              photo_library
            </span>
            <span className="font-mono text-xs sm:text-sm font-bold tracking-tight text-white/90 bg-white/10 px-2.5 py-1 rounded-md">
              {currentIndex + 1} / {images.length}
            </span>
          </div>

          <div className="min-w-0 flex-1 hidden sm:block">
            <p className="text-xs font-semibold text-white truncate">
              {currentImage.originalFilename}
            </p>
            <p className="text-[10px] font-mono text-[#bac7dd] flex items-center gap-2">
              <span>{formatFileSize(currentImage.fileSizeBytes)}</span>
              {currentImage.isThumbnail && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-[#3d4a5c] text-white text-[9px] font-bold">
                  ★ Thumbnail mặc định
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Controls & Close button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom controls */}
          <div className="hidden md:flex items-center bg-white/10 rounded-lg p-0.5 mr-2">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              className="p-1.5 hover:bg-white/15 rounded text-white/80 hover:text-white transition cursor-pointer"
              title="Thu nhỏ (-)"
              aria-label="Thu nhỏ ảnh"
            >
              <span className="material-symbols-outlined text-[18px]">zoom_out</span>
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="px-2 py-1 text-[11px] font-mono hover:bg-white/15 rounded text-white/80 hover:text-white transition cursor-pointer"
              title="Khôi phục kích thước gốc (0)"
              aria-label="Khôi phục kích thước ảnh"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
              className="p-1.5 hover:bg-white/15 rounded text-white/80 hover:text-white transition cursor-pointer"
              title="Phóng to (+)"
              aria-label="Phóng to ảnh"
            >
              <span className="material-symbols-outlined text-[18px]">zoom_in</span>
            </button>
          </div>

          {/* Download original button if url available */}
          {url && (
            <a
              href={url}
              download={currentImage.originalFilename}
              className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition cursor-pointer"
              title="Tải ảnh gốc về máy"
              aria-label="Tải ảnh gốc về máy"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
            </a>
          )}

          {/* Close / Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] sm:min-h-[44px] px-3 sm:px-4 rounded-lg bg-[#ba1a1a]/80 hover:bg-[#ba1a1a] active:scale-95 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm ml-1"
            title="Đóng (Esc)"
            aria-label="Đóng giao diện xem ảnh"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
            <span className="hidden xs:inline">Đóng</span>
          </button>
        </div>
      </header>

      {/* Main Image Stage */}
      <main
        className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center text-center text-white/80 p-6">
            <span className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-mono">Đang tải ảnh gốc hoàn chỉnh...</p>
            <p className="text-[11px] font-mono text-white/60 mt-1">{currentImage.originalFilename}</p>
          </div>
        )}

        {/* Error Fallback */}
        {error && (
          <div className="p-6 bg-red-950/60 border border-red-500/40 rounded-xl text-center max-w-md">
            <span className="material-symbols-outlined text-[40px] text-red-400 mb-2">
              broken_image
            </span>
            <p className="text-sm font-semibold text-white">Không thể hiển thị ảnh gốc</p>
            <p className="text-xs text-white/70 mt-1">{error}</p>
          </div>
        )}

        {/* High-Res Original Image */}
        {!loading && !error && url && (
          <div
            className="w-full h-full flex items-center justify-center overflow-auto p-1 cursor-zoom-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
            onDoubleClick={() => setZoomLevel((z) => (z === 1 ? 2 : 1))}
          >
            <img
              src={url}
              alt={currentImage.originalFilename || itemTitle || 'Hình ảnh'}
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 150ms ease-out',
              }}
              className="max-h-full max-w-full w-auto h-auto object-contain rounded drop-shadow-2xl select-none"
              draggable={false}
            />
          </div>
        )}

        {/* Left Navigation Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/90 active:scale-95 text-white flex items-center justify-center border border-white/20 transition cursor-pointer shadow-lg z-20"
            title="Ảnh trước (Mũi tên Trái)"
            aria-label="Xem ảnh trước"
          >
            <span className="material-symbols-outlined text-[28px] sm:text-[32px]">chevron_left</span>
          </button>
        )}

        {/* Right Navigation Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/90 active:scale-95 text-white flex items-center justify-center border border-white/20 transition cursor-pointer shadow-lg z-20"
            title="Ảnh tiếp theo (Mũi tên Phải)"
            aria-label="Xem ảnh tiếp theo"
          >
            <span className="material-symbols-outlined text-[28px] sm:text-[32px]">chevron_right</span>
          </button>
        )}
      </main>

      {/* Bottom Footer & Thumbnail Carousel */}
      <footer className="border-t border-white/10 bg-black/60 px-4 py-2.5 shrink-0 z-20">
        {/* Mobile Info Strip */}
        <div className="sm:hidden flex items-center justify-between text-xs text-white/90 mb-2 font-mono">
          <span className="truncate flex-1 pr-2">{currentImage.originalFilename}</span>
          <span className="shrink-0 text-white/60">{formatFileSize(currentImage.fileSizeBytes)}</span>
        </div>

        {/* Multi-image thumbnail carousel */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 no-scrollbar max-w-full">
            {images.map((img, idx) => {
              const isActive = idx === currentIndex;
              const isNearActive = Math.abs(idx - currentIndex) <= 2;
              return (
                <button
                  key={img.id || idx}
                  ref={(el) => {
                    if (el) {
                      thumbnailRefs.current[idx] = el;
                    } else {
                      thumbnailRefs.current[idx] = null;
                      if (thumbnailRefs.current.length > images.length) {
                        thumbnailRefs.current.length = images.length;
                      }
                    }
                  }}
                  type="button"
                  onClick={() => {
                    setZoomLevel(1);
                    setCurrentIndex(idx);
                  }}
                  className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                    isActive
                      ? 'border-white ring-2 ring-white/50 scale-105 opacity-100 shadow-md'
                      : 'border-white/20 opacity-50 hover:opacity-80'
                  }`}
                  aria-label={`Chuyển đến ảnh ${idx + 1}`}
                >
                  <ThumbnailItem
                    opfsPath={img.opfsPath}
                    alt={img.originalFilename}
                    isNearActive={isNearActive}
                  />
                  {img.isThumbnail && (
                    <span className="absolute bottom-0 right-0 bg-black/80 text-[8px] px-1 font-mono font-bold text-yellow-300">
                      ★
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Navigation tips */}
        <div className="flex items-center justify-between mt-1 pt-1 text-[11px] text-white/60 font-mono">
          <span className="hidden sm:inline">
            Mẹo: Dùng phím ← / → để chuyển ảnh, + / - để phóng to, Esc để đóng
          </span>
          <span className="sm:hidden text-white/50 text-[10px]">
            Mẹo: Vuốt ngang để chuyển ảnh
          </span>
        </div>
      </footer>
    </div>
  );
};

// Mini thumbnail component for bottom carousel strip with lazy loading & auto memory release
interface ThumbnailItemProps {
  opfsPath: string;
  alt: string;
  isNearActive: boolean;
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = React.memo(({ opfsPath, alt, isNearActive }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsInView(entry.isIntersecting);
        }
      },
      {
        rootMargin: '100px', // preload buffer ahead of scrolling
        threshold: 0.01,
      }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Only request & hold an OPFS Object URL when either in view or adjacent to active image
  const shouldLoad = isNearActive || isInView;
  const { url, loading } = useOPFSUrl(shouldLoad ? opfsPath : null);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      {url ? (
        <img
          src={url}
          alt={alt}
          className="w-full h-full object-cover transition-opacity duration-150"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-white/10 flex items-center justify-center">
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined text-[16px] text-white/50">image</span>
          )}
        </div>
      )}
    </div>
  );
});
