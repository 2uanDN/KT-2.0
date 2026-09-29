import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { SaveButton } from './SaveButton';
import { UndoToast } from '../feedback/UndoToast';
import { OfflineIndicator } from './OfflineIndicator';
import { ScreenErrorBoundary } from '../feedback/ScreenErrorBoundary';
import { searchService } from '../../services/SearchService';
import { seedInitialDataIfEmpty, scheduleBackgroundCleanup } from '../../db/seed';
import { onBroadcastMessage } from '../../utils/crossTabLock';

export const AppShell: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // 1. Fast seed check (returns immediately if not empty)
    seedInitialDataIfEmpty().then(() => {
      // 2. Initialize search index immediately without delay
      searchService.initialize();
      // 3. Schedule non-blocking background cleanup on idle
      scheduleBackgroundCleanup();
    });

    // 4. Synchronize search index across tabs on import or external update
    const unsubscribeSync = onBroadcastMessage((msg) => {
      if (msg.type === 'KT_IMPORT_COMPLETED' || msg.type === 'KT_CLEANUP_COMPLETED') {
        searchService.invalidateTagCache();
        searchService.rebuildIndex().catch(() => {});
      }
    });

    return () => {
      unsubscribeSync();
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#F3F3F3] flex justify-center text-[#1B1B1B] font-sans antialiased">
      {/* 480px Mobile Blueprint Constraint Container */}
      <div className="relative w-full max-w-[480px] min-h-screen bg-[#FFFFFF] border-x border-[#3D4A5C] shadow-2xl flex flex-col pb-16">
        <OfflineIndicator />
        <main className="flex-1 flex flex-col bg-[#FFFFFF]">
          <ScreenErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ScreenErrorBoundary>
        </main>
        <SaveButton />
        <BottomNav />
        <UndoToast />
      </div>
    </div>
  );
};
