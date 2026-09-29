import React, { useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = 'max-h-[85vh]',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[1px] transition-opacity animate-fadeIn">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Sheet Content container - constrained to max 480px with blueprint ink borders */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full max-w-[480px] bg-[#FFFFFF] rounded-t-xl sm:rounded-xl shadow-hard-lg flex flex-col ${maxHeight} overflow-hidden border-t-2 sm:border-2 border-[#3D4A5C] animate-in slide-in-from-bottom duration-150`}
      >
        {/* Drag handle */}
        <div className="pt-2 pb-1 flex justify-center sm:hidden bg-[#FAF9F7]">
          <div className="w-10 h-1 bg-[#3D4A5C]/40 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-4 py-3 border-b border-[#3D4A5C] flex items-center justify-between shrink-0 bg-[#FAF9F7]">
            <h3 className="type-headline-xs text-[#1B1B1B] tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] transition cursor-pointer press-xs"
              aria-label="Đóng bảng"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-4 pb-8 sm:pb-5 overflow-y-auto flex-1 bg-[#FFFFFF]">{children}</div>
      </div>
    </div>
  );
};
