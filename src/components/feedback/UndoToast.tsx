import React from 'react';
import { useToastStore } from '../../store/toastStore';

export const UndoToast: React.FC = () => {
  const { activeToast, dismiss } = useToastStore();

  if (!activeToast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[440px] bg-[#1B1B1B] text-white px-4 py-3 rounded-lg shadow-hard-lg flex items-center justify-between gap-3 border-2 border-[#3D4A5C] animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-[18px] text-[#A8C5B8]">info</span>
        <span className="text-xs font-mono font-medium truncate">{activeToast.message}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {activeToast.undoFn && (
          <button
            onClick={async () => {
              const fn = activeToast.undoFn;
              dismiss();
              if (fn) await fn();
            }}
            className="text-xs font-mono font-bold text-white px-3 py-1 rounded-md bg-[#3D4A5C] hover:bg-[#263345] border border-white/30 shadow-hard-xs transition cursor-pointer press-xs"
          >
            HOÀN TÁC
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Đóng"
          className="text-white/70 hover:text-white p-1 rounded transition cursor-pointer press-xs"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};
