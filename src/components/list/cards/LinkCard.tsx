import React, { useCallback } from 'react';
import type { LinkItem } from '../../../types/item';
import type { Tag } from '../../../types/tag';
import { BaseCard } from './BaseCard';
import type { CardVariant } from './cardUtils';
import { toastStore } from '../../../store/toastStore';

export interface LinkCardProps {
  item: LinkItem;
  variant?: CardVariant;
  onOpen: (id: string) => void;
  tags?: Tag[];
}

export const LinkCard: React.FC<LinkCardProps> = ({
  item,
  variant = 'library',
  onOpen,
  tags,
}) => {
  const linkDomain = item.domain || null;
  const contextLine = item.reason || '';

  const handleOpenLink = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (item.url) {
        try {
          window.open(item.url, '_blank', 'noopener,noreferrer');
        } catch {
          toastStore.show('Không thể mở liên kết');
        }
      }
    },
    [item.url]
  );

  return (
    <BaseCard
      item={item}
      variant={variant}
      onOpen={onOpen}
      tags={tags}
      contextLine={contextLine}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        {linkDomain ? (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#FFFFFF] border border-[#3D4A5C]/20 type-label-code text-[#3D4A5C] max-w-[60%] truncate min-w-0">
            <span className="material-symbols-outlined text-[13px] shrink-0">public</span>
            <span className="truncate">{linkDomain}</span>
          </div>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={handleOpenLink}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#3D4A5C] hover:bg-[#1B1B1B] active:scale-95 text-white text-[11px] font-mono font-bold shadow-hard-xs transition cursor-pointer border border-[#1B1B1B] shrink-0 press-xs ml-auto"
          title="Truy cập liên kết trong tab mới"
          aria-label="Truy cập liên kết"
        >
          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          <span>TRUY CẬP</span>
        </button>
      </div>
    </BaseCard>
  );
};
