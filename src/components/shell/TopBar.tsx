import React, { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchField } from '../filter/SearchField';

export type TopBarVariant =
  | {
      variant: 'list';
      title: string;
      onSearchClick?: () => void;
      onSortClick?: () => void;
      rightAction?: ReactNode;
    }
  | {
      variant: 'search';
      query: string;
      onQueryChange: (q: string) => void;
      onCancel: () => void;
    }
  | {
      variant: 'detail';
      backLabel: string;
      onBack?: () => void;
      actions?: ReactNode;
      title?: string;
    };

export const TopBar: React.FC<TopBarVariant> = (props) => {
  const navigate = useNavigate();

  if (props.variant === 'search') {
    return (
      <header className="sticky top-0 z-50 w-full h-12 bg-[#FAF9F7] border-b border-[#3D4A5C] px-3 flex items-center gap-2">
        <SearchField
          value={props.query}
          onChange={props.onQueryChange}
          onClear={() => props.onQueryChange('')}
          placeholder="Tìm kiếm trong kho tri thức..."
          autoFocus
        />
        <button
          type="button"
          onClick={props.onCancel}
          className="min-h-[36px] px-3 py-1.5 text-xs font-mono font-bold text-[#3D4A5C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] rounded-md transition cursor-pointer press-xs"
        >
          HỦY
        </button>
      </header>
    );
  }

  if (props.variant === 'detail') {
    return (
      <header className="sticky top-0 z-50 w-full h-12 bg-[#FAF9F7] border-b border-[#3D4A5C] px-3 sm:px-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={props.onBack ? props.onBack : () => navigate(-1)}
          className="min-h-[40px] min-w-[40px] flex items-center gap-1 text-xs font-mono font-bold text-[#3D4A5C] hover:text-[#1B1B1B] p-1 -ml-1 rounded-md hover:bg-[#E8E8E8] transition cursor-pointer shrink-0 press-xs"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>{props.backLabel}</span>
        </button>

        {props.title && (
          <h1 className="type-headline-xs text-[#1B1B1B] truncate min-w-0 flex-1 text-center px-1">
            {props.title}
          </h1>
        )}

        <div className="flex items-center gap-1 shrink-0">{props.actions}</div>
      </header>
    );
  }

  // List Variant
  return (
    <header className="sticky top-0 z-50 w-full h-12 bg-[#FAF9F7] border-b border-[#3D4A5C] px-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded bg-[#3D4A5C] border border-[#1B1B1B] flex items-center justify-center text-white text-[10px] font-mono font-bold shadow-hard-xs shrink-0">
          KT
        </div>
        <h1 className="type-headline-md text-[#1B1B1B] tracking-tight truncate">
          {props.title}
        </h1>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {props.onSearchClick && (
          <button
            type="button"
            onClick={props.onSearchClick}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 text-[#3D4A5C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] rounded-md transition cursor-pointer press-xs"
            aria-label="Mở tìm kiếm"
            title="Tìm kiếm"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>
        )}

        {props.rightAction}
      </div>
    </header>
  );
};
