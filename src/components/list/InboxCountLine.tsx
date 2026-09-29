import React from 'react';
import { Link } from 'react-router-dom';
import { useInboxCount } from '../../hooks/useLiveCount';

export const InboxCountLine: React.FC = () => {
  const count = useInboxCount();

  if (count <= 0) return null;

  return (
    <div className="mb-3.5 px-3.5 py-2.5 bg-[#FAF9F7] border border-[#3D4A5C] rounded-lg shadow-hard-xs flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 text-[#44474C]">
        <span className="material-symbols-outlined text-[18px] text-[#3D4A5C]">inbox</span>
        <span className="type-body-sm text-[#1B1B1B]">
          Có <strong className="font-bold text-[#3D4A5C] font-mono">{count}</strong> mục đang trong Hộp chờ
        </span>
      </div>
      <Link
        to="/inbox"
        className="type-label-code-bold text-[#3D4A5C] hover:text-[#1B1B1B] flex items-center gap-1 group"
      >
        <span>XỬ LÝ NGAY</span>
        <span className="material-symbols-outlined text-[14px] group-hover:translate-x-0.5 transition-transform">
          arrow_forward
        </span>
      </Link>
    </div>
  );
};
