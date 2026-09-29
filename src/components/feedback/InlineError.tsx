import React from 'react';

interface InlineErrorProps {
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({ message, onRetry, className = '' }) => {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`flex items-center justify-between p-2.5 bg-[#FFDAD6] text-[#93000A] border border-[#BA1A1A] rounded-lg text-xs font-mono shadow-hard-xs ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] shrink-0 text-[#BA1A1A]">error</span>
        <span className="font-bold">{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-mono font-bold underline text-xs ml-2 hover:opacity-80 shrink-0 cursor-pointer"
        >
          THỬ LẠI
        </button>
      )}
    </div>
  );
};
