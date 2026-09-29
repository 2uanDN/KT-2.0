import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ItemType } from '../../types/item';

interface SubAction {
  type: ItemType;
  label: string;
  icon: string;
  bgClass: string;
  textClass: string;
}

export const SaveButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Hide FAB on forms, settings, and search
  const isHidden =
    location.pathname.startsWith('/save') ||
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/search') ||
    location.pathname.endsWith('/edit');

  // Close when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, location.search]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (isHidden) return null;

  const actions: SubAction[] = [
    {
      type: 'note',
      label: 'Ghi chú',
      icon: 'description',
      bgClass: 'bg-[#E8D4B8]',
      textClass: 'text-[#1B1B1B]',
    },
    {
      type: 'file',
      label: 'Tệp',
      icon: 'upload_file',
      bgClass: 'bg-[#D4A5A5]',
      textClass: 'text-[#1B1B1B]',
    },
    {
      type: 'link',
      label: 'Liên kết',
      icon: 'link',
      bgClass: 'bg-[#B9B08A]',
      textClass: 'text-[#1B1B1B]',
    },
  ];

  const handleSelectType = (type: ItemType) => {
    setIsOpen(false);
    navigate(`/save?type=${type}`);
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-40 transition-opacity duration-150 animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* FAB and Expandable Sub-actions container */}
      <div className="fixed bottom-18 right-4 sm:right-[calc(50%-220px)] z-40 flex flex-col items-end pointer-events-none">
        {/* Vertical Sub-action Buttons Group */}
        <div
          className={`flex flex-col items-end gap-2.5 mb-3 transition-all duration-150 ease-out origin-bottom ${
            isOpen
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
          }`}
          role="menu"
          aria-orientation="vertical"
          aria-label="Tùy chọn tạo tri thức mới"
        >
          {actions.map((act) => (
            <div
              key={act.type}
              className="flex items-center gap-2 group cursor-pointer"
              onClick={() => handleSelectType(act.type)}
            >
              {/* Text Label pill */}
              <div className="px-2.5 py-1 rounded bg-[#FAF9F7] text-[#1B1B1B] shadow-hard-xs border border-[#3D4A5C] font-mono font-bold text-xs select-none group-hover:bg-white transition">
                {act.label}
              </div>

              {/* Sub-action circular button with icon */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectType(act.type);
                }}
                className={`w-10 h-10 rounded-full ${act.bgClass} ${act.textClass} border-2 border-[#1B1B1B] shadow-hard-sm flex items-center justify-center transition-transform duration-100 group-hover:scale-105 active:scale-95 cursor-pointer`}
                aria-label={`Tạo mới ${act.label}`}
              >
                <span className="material-symbols-outlined text-[19px]">{act.icon}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Main FAB Toggle Button (layout.fab.height 44px, shadow.hard-lg 4px 4px 0 #000) */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={isOpen ? 'Đóng menu tạo mới' : 'Mở rộng tạo tri thức mới'}
          className={`h-11 px-4 rounded-lg border-2 border-[#1B1B1B] shadow-hard-lg flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer pointer-events-auto press-fab ${
            isOpen
              ? 'bg-[#1B1B1B] text-white'
              : 'bg-[#FAF9F7] text-[#1B1B1B] hover:bg-white'
          }`}
        >
          <span className={`material-symbols-outlined text-[20px] transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}>
            {isOpen ? 'close' : 'add'}
          </span>
          <span className="font-mono text-xs font-bold uppercase tracking-wider">
            {isOpen ? 'Đóng' : 'Tạo mới'}
          </span>
        </button>
      </div>
    </>
  );
};
