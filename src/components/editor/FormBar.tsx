import React from 'react';

interface FormBarProps {
  onCancel: () => void;
  onSubmit: () => void;
  isDirty: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  title: string;
}

export const FormBar: React.FC<FormBarProps> = ({
  onCancel,
  onSubmit,
  isSubmitting,
  canSubmit,
  title,
}) => {
  return (
    <header className="sticky top-0 z-50 h-12 bg-[#FAF9F7] border-b border-[#3D4A5C] px-4 flex items-center justify-between">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="min-h-[36px] px-2.5 py-1 rounded-md type-label-code-bold text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] transition cursor-pointer press-xs"
      >
        HỦY
      </button>

      <h1 className="type-headline-xs text-[#1B1B1B] truncate max-w-[220px]">
        {title}
      </h1>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || isSubmitting}
        className="min-h-[36px] px-4 py-1.5 rounded-lg type-label-code-bold bg-[#3D4A5C] text-white hover:bg-[#1B1B1B] disabled:opacity-40 disabled:cursor-not-allowed border border-[#1B1B1B] shadow-hard-xs transition cursor-pointer flex items-center gap-1.5 press-sm"
      >
        {isSubmitting && (
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        <span>{isSubmitting ? 'ĐANG LƯU...' : 'LƯU'}</span>
      </button>
    </header>
  );
};
