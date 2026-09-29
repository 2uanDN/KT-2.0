import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F7] text-[#1B1B1B] border border-[#3D4A5C] text-xs font-mono font-bold shadow-hard-xs hover:bg-[#FFFFFF] hover:border-[#1B1B1B] transition cursor-pointer press-xs"
        title="Cài đặt ứng dụng PWA"
      >
        <span className="material-symbols-outlined text-[16px] text-[#3D4A5C]">download</span>
        <span className="hidden xs:inline">CÀI APP</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F7] text-[#1B1B1B] border border-[#3D4A5C] text-xs font-mono font-bold shadow-hard-xs hover:bg-[#FFFFFF] hover:border-[#1B1B1B] transition cursor-pointer press-xs"
        >
          <span className="material-symbols-outlined text-[15px] text-[#3D4A5C]">ios_share</span>
          <span className="hidden xs:inline">CÀI PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-lg bg-[#FAF9F7] p-5 shadow-hard-lg border-2 border-[#3D4A5C]">
              <div className="flex items-center gap-2 mb-3 text-[#1B1B1B]">
                <span className="material-symbols-outlined text-[24px] text-[#3D4A5C]">
                  install_mobile
                </span>
                <h3 className="type-headline-xs text-[#1B1B1B]">Cài đặt trên iPhone / iPad</h3>
              </div>
              <p className="type-body-xs text-[#44474C] leading-relaxed mb-4">
                1. Nhấn nút <strong className="font-bold text-[#1B1B1B]">Chia sẻ (Share)</strong> trên thanh công cụ Safari.<br />
                2. Cuộn xuống và chọn <strong className="font-bold text-[#1B1B1B]">Thêm vào MH chính (Add to Home Screen)</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-[#3D4A5C] py-2 text-xs font-mono font-bold text-white hover:bg-[#1B1B1B] border border-[#1B1B1B] shadow-hard-xs transition cursor-pointer press-sm"
              >
                ĐÃ HIỂU
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
