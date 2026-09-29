import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-lg bg-[#FFDAD6] text-[#93000A] border border-[#BA1A1A] px-3 py-1 text-xs font-mono font-bold shadow-hard-xs animate-pulse">
      <span className="w-2 h-2 rounded-full bg-[#BA1A1A]" />
      <span>Ngoại tuyến — Dữ liệu lưu cục bộ</span>
    </div>
  );
};
