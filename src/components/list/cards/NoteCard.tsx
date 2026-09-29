import React, { useState, useCallback, useMemo } from 'react';
import type { NoteItem } from '../../../types/item';
import type { Tag } from '../../../types/tag';
import { BaseCard } from './BaseCard';
import type { CardVariant } from './cardUtils';
import { toastStore } from '../../../store/toastStore';

export interface NoteCardProps {
  item: NoteItem;
  variant?: CardVariant;
  onOpen: (id: string) => void;
  tags?: Tag[];
}

export const NoteCard: React.FC<NoteCardProps> = ({
  item,
  variant = 'library',
  onOpen,
  tags,
}) => {
  const [copiedNote, setCopiedNote] = useState(false);

  const contextLine = useMemo(() => {
    const lines = (item.body || '').split('\n').filter((l) => l.trim().length > 0);
    return lines.length > 0 ? lines[0].replace(/^[#*>\s_\-]+/, '').slice(0, 120) : '';
  }, [item.body]);

  const handleCopyNote = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const textToCopy = item.body || item.title || '';
      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopiedNote(true);
        toastStore.show('Đã sao chép nội dung ghi chú');
        setTimeout(() => setCopiedNote(false), 2000);
      } catch {
        toastStore.show('Không thể sao chép nội dung');
      }
    },
    [item.body, item.title]
  );

  return (
    <BaseCard
      item={item}
      variant={variant}
      onOpen={onOpen}
      tags={tags}
      contextLine={contextLine}
    >
      <div className="flex items-center justify-end mb-2.5">
        <button
          type="button"
          onClick={handleCopyNote}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold shadow-hard-xs transition cursor-pointer border press-xs shrink-0 ${
            copiedNote
              ? 'bg-[#CDE8D6] text-[#2E6B48] border-[#2E6B48]'
              : 'bg-[#FFFFFF] hover:bg-[#E8E8E8] text-[#1B1B1B] border-[#3D4A5C]/40 hover:border-[#1B1B1B]'
          }`}
          title="Sao chép nội dung ghi chú"
          aria-label="Sao chép nội dung ghi chú"
        >
          <span className="material-symbols-outlined text-[14px]">
            {copiedNote ? 'check' : 'content_copy'}
          </span>
          <span>{copiedNote ? 'ĐÃ CHÉP' : 'SAO CHÉP'}</span>
        </button>
      </div>
    </BaseCard>
  );
};
