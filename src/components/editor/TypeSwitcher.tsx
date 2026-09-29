import React from 'react';
import type { ItemType } from '../../types/item';

interface TypeSwitcherProps {
  selectedType: ItemType;
  onChange: (type: ItemType) => void;
  disabled?: boolean;
}

export const TypeSwitcher: React.FC<TypeSwitcherProps> = ({
  selectedType,
  onChange,
  disabled = false,
}) => {
  const types: {
    id: ItemType;
    label: string;
    icon: string;
  }[] = [
    {
      id: 'note',
      label: 'GHI CHÚ',
      icon: 'description',
    },
    {
      id: 'file',
      label: 'TỆP',
      icon: 'draft',
    },
    {
      id: 'link',
      label: 'LIÊN KẾT',
      icon: 'link',
    },
  ];

  return (
    <div className="grid grid-cols-3 p-1 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg type-label-code-bold select-none shadow-hard-xs">
      {types.map((t) => {
        const isSelected = selectedType === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(t.id)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-md font-mono font-bold text-xs transition cursor-pointer press-xs border ${
              isSelected
                ? 'bg-[#3D4A5C] text-white border-[#1B1B1B] shadow-hard-xs'
                : 'border-transparent text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#FFFFFF]'
            } disabled:opacity-50`}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};
