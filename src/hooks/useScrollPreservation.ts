import { useEffect, useRef } from 'react';

export function useScrollPreservation(screenKey: string) {
  const listRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);

  useEffect(() => {
    // Capture reference to DOM element in closure
    const el = listRef.current;
    const storageKey = `scroll:${screenKey}`;
    const saved = sessionStorage.getItem(storageKey);

    // Initial restore if position already recorded
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        lastScrollTopRef.current = parsed;
        if (el) {
          el.scrollTop = parsed;
        }
        if (window.scrollY === 0) {
          window.scrollTo({ top: parsed, behavior: 'instant' as ScrollBehavior });
        }
      }
    }

    // Keep track of scroll position continuously
    const updateScrollPos = () => {
      if (el && el.scrollTop > 0) {
        lastScrollTopRef.current = el.scrollTop;
      } else if (window.scrollY > 0) {
        lastScrollTopRef.current = window.scrollY;
      } else if (el) {
        lastScrollTopRef.current = el.scrollTop;
      }
    };

    const handleScroll = () => {
      updateScrollPos();
    };

    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Handle asynchronous content rendering (e.g. Dexie live queries)
    let isMounted = true;
    let hasRestored = false;
    let rafId: number | null = null;
    let observer: MutationObserver | null = null;

    if (saved) {
      const target = parseInt(saved, 10);
      if (target > 0) {
        const attemptRestore = () => {
          if (!isMounted || hasRestored) return;
          const elScrollable = el && el.scrollHeight > el.clientHeight;
          const winScrollable = document.documentElement.scrollHeight > window.innerHeight;

          if (elScrollable) {
            el.scrollTop = target;
            if (el.scrollTop > 0) {
              hasRestored = true;
              if (observer) {
                observer.disconnect();
                observer = null;
              }
              return;
            }
          }
          if (winScrollable) {
            window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior });
            if (window.scrollY > 0) {
              hasRestored = true;
              if (observer) {
                observer.disconnect();
                observer = null;
              }
            }
          }
        };

        // Attempt immediately and after microtask/frame
        attemptRestore();
        rafId = requestAnimationFrame(() => {
          if (isMounted) {
            attemptRestore();
          }
        });

        // Observe DOM child additions until target scroll is applied
        if (!hasRestored && typeof MutationObserver !== 'undefined' && el) {
          observer = new MutationObserver(() => {
            if (isMounted) {
              attemptRestore();
            }
          });
          observer.observe(el, { childList: true, subtree: true });
        }
      }
    }

    const saveToStorage = () => {
      updateScrollPos();
      sessionStorage.setItem(storageKey, String(lastScrollTopRef.current));
    };

    window.addEventListener('pagehide', saveToStorage);

    return () => {
      isMounted = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (el) {
        el.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', saveToStorage);

      // React 19 detaches DOM refs (listRef.current = null) before calling effect cleanups.
      // We resolve the scroll position through the tracked lastScrollTopRef, or closure-captured el / window.
      const finalScrollPos =
        (el && el.scrollTop > 0 ? el.scrollTop : undefined) ??
        (window.scrollY > 0 ? window.scrollY : undefined) ??
        lastScrollTopRef.current;

      sessionStorage.setItem(storageKey, String(finalScrollPos));
    };
  }, [screenKey]);

  return listRef;
}

