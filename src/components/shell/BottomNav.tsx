import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useInboxCount } from '../../hooks/useLiveCount';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const inboxCount = useInboxCount();

  // Hide BottomNav on detail screens, edit, save, settings, and search screens
  const isHidden =
    location.pathname.startsWith('/items/') ||
    location.pathname.startsWith('/save') ||
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/search') ||
    location.pathname.endsWith('/edit');

  if (isHidden) return null;

  const tabs = [
    { to: '/', label: 'Thư viện', icon: 'auto_stories' },
    { to: '/collections', label: 'Bộ sưu tập', icon: 'folder_open' },
    { to: '/inbox', label: 'Hộp chờ', icon: 'inbox', badge: inboxCount },
    { to: '/tags', label: 'Thẻ', icon: 'tag' },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Điều hướng chính"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-14 bg-[#FAF9F7] border-t border-[#3D4A5C] z-50 grid grid-cols-4 select-none"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center relative transition-colors ${
              isActive
                ? 'border-t-4 border-[#3D4A5C] bg-[#FFFFFF] text-[#3D4A5C] font-bold'
                : 'border-t-4 border-transparent text-[#44474C] hover:text-[#1B1B1B] hover:bg-[#FAF9F7]'
            }`
          }
        >
          <div className="relative flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[16px] px-1 rounded-full bg-[#BA1A1A] text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-hard-xs border border-[#1B1B1B]">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono mt-0.5 tracking-tight font-medium">
            {tab.label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
};
