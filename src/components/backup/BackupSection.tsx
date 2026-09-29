import React, { type ReactNode } from 'react';

interface BackupSectionProps {
  title: string;
  icon: string;
  badge?: string | number;
  children: ReactNode;
  action?: ReactNode;
}

export const BackupSection: React.FC<BackupSectionProps> = ({
  title,
  icon,
  badge,
  children,
  action,
}) => {
  return (
    <section className="bg-[#FFFFFF] border-2 border-[#3D4A5C] rounded-lg shadow-hard-sm overflow-hidden">
      {/* Section Header */}
      <div className="px-3.5 py-2.5 bg-[#FAF9F7] border-b border-[#3D4A5C] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[19px] text-[#3D4A5C] shrink-0">
            {icon}
          </span>
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#1B1B1B] truncate">
            {title}
          </h2>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E2E2E2] text-[#3D4A5C] border border-[#3D4A5C]/20">
              {badge}
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Section Body */}
      <div className="p-3.5 sm:p-4 space-y-3.5">{children}</div>
    </section>
  );
};
