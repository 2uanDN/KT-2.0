import React from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateAction {
  label: string;
  to?: string;
  onClick?: () => void;
  icon?: string;
}

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: string;
  action?: EmptyStateAction | null;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  subtitle,
  icon = 'inventory_2',
  action,
}) => {
  const getActionIcon = () => {
    if (!action) return 'arrow_forward';
    if (action.icon) return action.icon;
    if (action.to) return 'arrow_forward';
    const lowerLabel = action.label.toLowerCase();
    if (lowerLabel.includes('lọc') || lowerLabel.includes('xóa') || lowerLabel.includes('clear')) {
      return 'filter_alt_off';
    }
    return 'add';
  };

  return (
    <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 rounded-lg bg-[#FAF9F7] border border-[#3D4A5C] shadow-hard-xs flex items-center justify-center text-[#3D4A5C] mb-4">
        <span className="material-symbols-outlined text-[28px]">{icon}</span>
      </div>

      <h3 className="type-headline-xs text-[#1B1B1B] mb-1.5">{title}</h3>

      {subtitle && (
        <p className="type-body-sm text-[#44474C] max-w-xs mb-5 leading-relaxed">
          {subtitle}
        </p>
      )}

      {action && (
        <div>
          {action.to ? (
            <Link
              to={action.to}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white rounded-lg text-xs font-mono font-bold shadow-hard-sm border border-[#1B1B1B] transition cursor-pointer press-sm"
            >
              <span>{action.label}</span>
              <span className="material-symbols-outlined text-[15px]">{getActionIcon()}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white rounded-lg text-xs font-mono font-bold shadow-hard-sm border border-[#1B1B1B] transition cursor-pointer press-sm"
            >
              <span className="material-symbols-outlined text-[15px]">{getActionIcon()}</span>
              <span>{action.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
