import React, { useState, useEffect } from 'react';
import { Sheet } from './Sheet';

interface NameSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
  initialValue?: string;
  title?: string;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
}

export const NameSheet: React.FC<NameSheetProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialValue = '',
  title = 'Tạo bộ sưu tập mới',
  label = 'Tên bộ sưu tập',
  placeholder = 'Nhập tên bộ sưu tập...',
  submitLabel = 'Lưu',
}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialValue);
    setError(null);
  }, [initialValue, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Tên không được để trống');
      return;
    }
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra');
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="type-label-code-bold text-[#3D4A5C] mb-1.5 block">
            {label}
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            autoFocus
            className="w-full px-3 py-2 border border-[#3D4A5C] rounded-lg text-sm bg-[#FFFFFF] text-[#1B1B1B] placeholder-[#75777D] shadow-hard-xs focus:ring-2 focus:ring-[#3D4A5C] focus:outline-none"
          />
          {error && <p className="text-xs text-[#BA1A1A] mt-1 font-mono font-bold">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3D4A5C]/20">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] transition cursor-pointer press-xs"
          >
            HỦY
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#3D4A5C] hover:bg-[#1B1B1B] text-white border border-[#1B1B1B] shadow-hard-xs disabled:opacity-50 transition cursor-pointer press-sm"
          >
            {submitLabel.toUpperCase()}
          </button>
        </div>
      </form>
    </Sheet>
  );
};
