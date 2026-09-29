import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface ScreenErrorViewProps {
  error?: Error | unknown;
  onReset?: () => void;
  screenTitle?: string;
  isRoot?: boolean;
}

export const ScreenErrorView: React.FC<ScreenErrorViewProps> = ({
  error,
  onReset,
  screenTitle,
  isRoot = false,
}) => {
  let navigate: ReturnType<typeof useNavigate> | null = null;
  try {
    // Attempt to use React Router navigation if mounted inside router context
    navigate = useNavigate();
  } catch {
    navigate = null;
  }

  const [showDetails, setShowDetails] = useState(false);

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : (error as { statusText?: string })?.statusText ||
        'Đã xảy ra lỗi không mong muốn khi tải hoặc kết xuất dữ liệu màn hình.';

  const errorStack = error instanceof Error ? error.stack : null;

  const handleRetry = () => {
    if (onReset) {
      onReset();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    if (onReset) {
      onReset();
    }
    if (navigate) {
      navigate('/');
    } else {
      window.location.href = '/';
    }
  };

  const content = (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto my-auto">
      {/* Blueprint Error Icon Box */}
      <div className="w-16 h-16 rounded-xl bg-[#FFDAD6] border-2 border-[#BA1A1A] flex items-center justify-center mb-4 shadow-hard-xs">
        <span className="material-symbols-outlined text-[36px] text-[#BA1A1A]">
          error_outline
        </span>
      </div>

      {/* Screen Title or Badge */}
      <div className="inline-block px-2.5 py-0.5 mb-2 bg-[#FAF9F7] border border-[#3D4A5C]/30 rounded text-xs font-mono font-bold text-[#3D4A5C]">
        {screenTitle ? `MÀN HÌNH: ${screenTitle.toUpperCase()}` : 'SỰ CỐ HIỂN THỊ'}
      </div>

      <h2 className="type-headline-md font-bold text-[#1B1B1B] mb-2 leading-tight">
        Không thể hiển thị nội dung
      </h2>

      <p className="type-body-sm text-[#44474C] mb-5 leading-relaxed text-sm">
        Ứng dụng gặp sự cố khi xử lý dữ liệu của màn hình này. Dữ liệu trong Kho Tri Thức của bạn
        vẫn an toàn trên thiết bị.
      </p>

      {/* Collapsible Error Info */}
      <div className="w-full text-left mb-6">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between p-2.5 bg-[#FAF9F7] border border-[#3D4A5C]/30 rounded-lg text-xs font-mono font-bold text-[#3D4A5C] hover:bg-[#F3F3F3] transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">terminal</span>
            <span>Chi tiết kỹ thuật ({errorMessage.slice(0, 30)}...)</span>
          </span>
          <span className="material-symbols-outlined text-[16px]">
            {showDetails ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {showDetails && (
          <div className="mt-2 p-3 bg-[#1B1B1B] text-[#D6E3FA] rounded-lg border border-[#3D4A5C] font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed select-all">
            <p className="font-bold text-[#FFDAD6] mb-1">Error: {errorMessage}</p>
            {errorStack && (
              <pre className="text-[#A8C5B8] whitespace-pre-wrap break-all text-[10px] mt-2">
                {errorStack}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleRetry}
          className="w-full py-2.5 px-4 bg-[#3D4A5C] hover:bg-[#263345] text-white font-mono font-bold text-xs rounded-lg border border-[#1B1B1B] shadow-hard-xs flex items-center justify-center gap-2 cursor-pointer transition active:translate-y-0.5"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          <span>THỬ LẠI</span>
        </button>

        <button
          type="button"
          onClick={handleGoHome}
          className="w-full py-2.5 px-4 bg-[#FAF9F7] hover:bg-[#EEEEEE] text-[#1B1B1B] font-mono font-bold text-xs rounded-lg border border-[#3D4A5C] shadow-hard-xs flex items-center justify-center gap-2 cursor-pointer transition active:translate-y-0.5"
        >
          <span className="material-symbols-outlined text-[16px]">home</span>
          <span>VỀ THƯ VIỆN</span>
        </button>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-xs font-mono text-[#75777D] hover:text-[#1B1B1B] underline py-1 cursor-pointer transition"
        >
          Tải lại ứng dụng hoàn toàn
        </button>
      </div>
    </div>
  );

  if (isRoot) {
    return (
      <div className="min-h-screen w-full bg-[#F3F3F3] flex justify-center text-[#1B1B1B] font-sans antialiased">
        <div className="relative w-full max-w-[480px] min-h-screen bg-[#FFFFFF] border-x border-[#3D4A5C] shadow-2xl flex flex-col justify-center">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
