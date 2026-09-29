import React from 'react';

interface ProgressBarProps {
  phase: string;
  message: string;
  percent?: number;
  doneCount?: number;
  totalCount?: number;
  doneBytes?: number;
  totalBytes?: number;
  onCancel?: () => void;
  canCancel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  phase,
  message,
  percent,
  doneCount,
  totalCount,
  onCancel,
  canCancel = true,
}) => {
  const calculatedPercent =
    typeof percent === 'number'
      ? Math.min(100, Math.max(0, Math.round(percent)))
      : totalCount && totalCount > 0 && doneCount !== undefined
      ? Math.min(100, Math.max(0, Math.round((doneCount / totalCount) * 100)))
      : null;

  return (
    <div className="p-4 rounded-lg bg-[#FAF9F7] border border-[#3D4A5C] shadow-hard-xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3D4A5C] animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#3D4A5C]">
            {phase}
          </span>
        </div>
        {calculatedPercent !== null && (
          <span className="font-mono text-xs font-bold text-[#1B1B1B]">
            {calculatedPercent}%
          </span>
        )}
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 rounded bg-[#E2E2E2] overflow-hidden border border-[#3D4A5C]/30">
        <div
          className={`h-full bg-[#3D4A5C] transition-all duration-200 ${
            calculatedPercent === null ? 'w-full animate-indeterminate' : ''
          }`}
          style={calculatedPercent !== null ? { width: `${calculatedPercent}%` } : undefined}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-[#44474C]">
        <p className="truncate flex-1 font-mono text-[11px]">{message}</p>
        {onCancel && canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="ml-2 px-2.5 py-1 rounded text-xs font-mono font-bold text-[#BA1A1A] hover:bg-[#FFDAD6]/50 border border-[#BA1A1A]/30 transition cursor-pointer press-xs shrink-0"
          >
            HỦY
          </button>
        )}
      </div>
    </div>
  );
};
