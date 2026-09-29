import React from 'react';

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  onClear?: () => void;
  icon?: string;
  count?: number;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  isActive,
  onClick,
  onClear,
  icon,
  count,
}) => {
  if (onClear && isActive) {
    return (
      <div className="inline-flex items-center rounded-lg bg-[#3D4A5C] text-white border border-[#1B1B1B] shadow-hard-sm shrink-0 select-none overflow-hidden">
        <button
          type="button"
          onClick={onClick}
          aria-pressed={true}
          className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 type-label-code-bold cursor-pointer hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 press-xs"
        >
          {icon && (
            <span className="material-symbols-outlined text-[15px]">{icon}</span>
          )}
          <span>{label}</span>
          {count !== undefined && (
            <span className="type-nano-code px-1.5 py-0.5 rounded-xs font-mono font-bold bg-white text-[#3D4A5C]">
              {count}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="pr-2.5 pl-1.5 py-1.5 text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1"
          aria-label={`Xóa bộ lọc ${label}`}
          title={`Xóa bộ lọc ${label}`}
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg type-label-code-bold transition-all duration-100 cursor-pointer shrink-0 border select-none press-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D4A5C] focus-visible:ring-offset-2 ${
        isActive
          ? 'bg-[#3D4A5C] text-white border-[#1B1B1B] shadow-hard-sm'
          : 'bg-[#FAF9F7] text-[#44474C] border-[#3D4A5C]/30 hover:border-[#3D4A5C] hover:text-[#1B1B1B] hover:bg-[#FFFFFF]'
      }`}
    >
      {icon && (
        <span className="material-symbols-outlined text-[15px]">{icon}</span>
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`type-nano-code px-1.5 py-0.5 rounded-xs font-mono font-bold ${
            isActive ? 'bg-white text-[#3D4A5C]' : 'bg-[#E0DFDE] text-[#44474C]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};
