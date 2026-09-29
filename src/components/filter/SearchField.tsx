import React, { useRef, useEffect } from 'react';

interface SearchFieldProps {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onClear,
  autoFocus = true,
  placeholder = 'Tìm kiếm tiêu đề, nội dung, tệp, liên kết...',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="relative flex-1">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#3D4A5C]">
        search
      </span>
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 bg-[#FFFFFF] border border-[#3D4A5C] rounded-lg text-sm text-[#1B1B1B] placeholder-[#75777D] focus:outline-none focus:ring-2 focus:ring-[#3D4A5C] focus:border-[#3D4A5C] shadow-hard-xs transition [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#75777D] hover:text-[#1B1B1B] hover:bg-[#F3F3F3] p-1 rounded-full flex items-center justify-center transition cursor-pointer"
          aria-label="Xóa từ khóa tìm kiếm"
          title="Xóa tìm kiếm"
        >
          <span className="material-symbols-outlined text-[17px]">close</span>
        </button>
      )}
    </div>
  );
};
