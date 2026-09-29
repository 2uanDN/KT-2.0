import React from 'react';

interface KeepSwitchProps {
  keepLong: boolean;
  onChange: (keep: boolean) => void;
}

export const KeepSwitch: React.FC<KeepSwitchProps> = ({ keepLong, onChange }) => {
  return (
    <div
      onClick={() => onChange(!keepLong)}
      className={`flex items-center justify-between p-3.5 rounded-lg border transition-all cursor-pointer select-none ${
        keepLong
          ? 'bg-[#FAF9F7] border-2 border-[#3D4A5C] shadow-hard-xs'
          : 'bg-[#FFFFFF] border border-[#3D4A5C]/30 hover:border-[#3D4A5C]'
      }`}
      role="switch"
      aria-checked={keepLong}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange(!keepLong);
        }
      }}
    >
      <div className="flex items-start gap-2.5 pr-2">
        <div
          className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 mt-0.5 border transition-colors ${
            keepLong
              ? 'bg-[#3D4A5C] text-white border-[#1B1B1B]'
              : 'bg-[#FAF9F7] text-[#44474C] border-[#3D4A5C]/30'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">
            {keepLong ? 'bookmark_added' : 'inbox'}
          </span>
        </div>
        <div>
          <span className="type-label-code-bold text-[#1B1B1B] block">
            GIỮ LÂU DÀI (VÀO THƯ VIỆN NGAY)
          </span>
          <p className="type-body-xs text-[#44474C] leading-relaxed mt-0.5">
            {keepLong
              ? 'Mục sẽ lưu trực tiếp vào Thư viện chính thức.'
              : 'Mục sẽ được đưa vào Hộp chờ để bạn phân loại sau.'}
          </p>
        </div>
      </div>

      <button
        id="keep-long-switch"
        type="button"
        role="switch"
        aria-checked={keepLong}
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!keepLong);
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-[#1B1B1B] transition-colors duration-150 ease-in-out focus:outline-none ${
          keepLong ? 'bg-[#3D4A5C]' : 'bg-[#E2E2E2]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-hard-xs transition duration-150 ease-in-out mt-[1px] ${
            keepLong ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
};
