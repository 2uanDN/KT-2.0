import React, { useState, useEffect } from 'react';
import { toastStore } from '../../store/toastStore';
import type { LinkItem } from '../../types/item';

interface LinkPanelProps {
  item: LinkItem;
}

export const LinkPanel: React.FC<LinkPanelProps> = ({ item }) => {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset image error state when preview URL changes
  useEffect(() => {
    setImageError(false);
  }, [item.previewImageUrl]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      toastStore.show('Đã sao chép liên kết vào bộ nhớ tạm');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastStore.show('Không thể sao chép liên kết');
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Link Card */}
      <div className="bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] overflow-hidden shadow-hard-md">
        {/* Preview image if available */}
        {item.previewImageUrl && !imageError && (
          <div className="relative w-full h-48 sm:h-56 bg-[#F3F3F3] border-b border-[#3D4A5C]/20 overflow-hidden flex items-center justify-center">
            <img
              src={item.previewImageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-xl opacity-20 scale-125 pointer-events-none select-none"
            />
            <img
              src={item.previewImageUrl}
              alt={item.title}
              className="relative z-10 max-h-full max-w-full w-auto h-auto object-contain p-2 drop-shadow-xs"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        <div className="p-4 min-w-0">
          <div className="flex items-center gap-1.5 type-label-code-bold text-[#3D4A5C] mb-1.5">
            <span className="material-symbols-outlined text-[15px]">public</span>
            <span className="truncate min-w-0">{item.domain || 'LIÊN KẾT WEB'}</span>
          </div>

          <h1 className="type-headline-md text-[#1B1B1B] mb-3 break-words [overflow-wrap:anywhere] leading-snug">
            {item.title}
          </h1>

          {/* URL Box with refined Copy button at the end */}
          <div className="flex items-center justify-between gap-2 p-2.5 bg-[#FFFFFF] border border-[#3D4A5C]/30 rounded-lg shadow-hard-xs">
            <span className="truncate flex-1 font-mono text-xs text-[#1B1B1B] select-all min-w-0 font-medium" title={item.url}>
              {item.url}
            </span>
            <button
              type="button"
              onClick={handleCopyUrl}
              className={`shrink-0 p-1.5 rounded transition cursor-pointer flex items-center justify-center press-xs ${
                copied
                  ? 'bg-[#CDE8D6] text-[#2E6B48]'
                  : 'text-[#3D4A5C] hover:text-[#1B1B1B] hover:bg-[#F3F3F3] active:bg-[#E8E8E8]'
              }`}
              title="Sao chép địa chỉ Web"
              aria-label="Sao chép địa chỉ Web"
            >
              <span className="material-symbols-outlined text-[18px]">
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Reason / Note on why it was saved */}
      {item.reason && (
        <div className="bg-[#FAF9F7] rounded-lg border border-[#3D4A5C] p-4 shadow-hard-md">
          <h2 className="type-label-code-bold text-[#3D4A5C] mb-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">tips_and_updates</span>
            <span>VÌ SAO GIỮ LIÊN KẾT NÀY?</span>
          </h2>
          <p className="type-body-sm text-[#1B1B1B] whitespace-pre-wrap leading-relaxed">
            {item.reason}
          </p>
        </div>
      )}
    </div>
  );
};
