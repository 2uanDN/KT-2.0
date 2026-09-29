/**
 * Utility for reference-counted body scroll locking.
 * Prevents race conditions and permanent locks when multiple modals,
 * sheets, or nested dialogs open and close in arbitrary orders.
 */

let lockCount = 0;
let originalOverflow: string | null = null;

export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = originalOverflow ?? '';
      originalOverflow = null;
    }
  };
}
