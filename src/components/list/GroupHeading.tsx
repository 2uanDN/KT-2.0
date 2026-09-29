import React from 'react';

interface GroupHeadingProps {
  title: string;
  icon?: string;
  count?: number;
}

export const GroupHeading: React.FC<GroupHeadingProps> = ({ title, icon, count }) => {
  return (
    <div className="flex items-center gap-2 py-2 px-1 type-label-code-bold text-[#3D4A5C]">
      {icon && <span className="material-symbols-outlined text-[16px]">{icon}</span>}
      <span>{title}</span>
      {count !== undefined && (
        <span className="type-nano-code font-bold px-1.5 py-0.5 rounded-xs bg-[#FAF9F7] text-[#3D4A5C] border border-[#3D4A5C]/30 shadow-hard-xs">
          {count}
        </span>
      )}
      <div className="flex-1 h-px bg-[#3D4A5C]/20 ml-2" />
    </div>
  );
};
