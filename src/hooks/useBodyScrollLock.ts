import { useEffect } from 'react';
import { lockBodyScroll } from '../utils/scrollLock';

/**
 * Hook to lock body scroll while a modal, sheet, or overlay is open.
 * Uses reference counting so nested or concurrent overlays safely restore
 * body overflow only when all overlays have closed.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;
    const unlock = lockBodyScroll();
    return () => {
      unlock();
    };
  }, [isLocked]);
}
