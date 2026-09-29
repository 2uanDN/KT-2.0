import React from 'react';

interface PinSwitchProps {
  isPinned: boolean;
  onChange: (pinned: boolean) => void;
}

export const PinSwitch: React.FC<PinSwitchProps> = ({ isPinned, onChange }) => {
  return (
    <div
      onClick={() => onChange(!isPinned)}
      className={`flex items-center justify-between p-3.5 rounded-lg border transition-all cursor-pointer select-none ${
        isPinned
          ? 'bg-[#FAF9F7] border-2 border-[#3D4A5C] shadow-hard-xs'
          : 'bg-[#FFFFFF] border border-[#3D4A5C]/30 hover:border-[#3D4A5C]'
      }`}
      role="switch"
      aria-checked={isPinned}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange(!isPinned);
        }
      }}
    >
      <div className="flex items-start gap-2.5 pr-2">
        <div
          className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 mt-0.5 border transition-colors ${
            isPinned
              ? 'bg-[#3D4A5C] text-white border-[#1B1B1B]'
              : 'bg-[#FAF9F7] text-[#44474C] border-[#3D4A5C]/30'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">push_pin</span>
        </div>
        <div>
          <span className="type-label-code-bold text-[#1B1B1B] block">
            GHIM LÊN ĐẦU TRANG
          </span>
          <p className="type-body-xs text-[#44474C] leading-relaxed mt-0.5">
            {isPinned
              ? 'Mục này sẽ được ưu tiên hiển thị ở vị trí đầu danh sách.'
              : 'Mục hiển thị theo thứ tự thời gian thông thường.'}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isPinned}
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!isPinned);
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-[#1B1B1B] transition-colors duration-150 ease-in-out focus:outline-none ${
          isPinned ? 'bg-[#3D4A5C]' : 'bg-[#E2E2E2]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-hard-xs transition duration-150 ease-in-out mt-[1px] ${
            isPinned ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
};
