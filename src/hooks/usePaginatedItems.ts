import { useState, useMemo, useEffect, useRef } from 'react';

const PAGE_SIZE = 10; // P2-C Pagination page size

export function usePaginatedItems<T>(
  items: T[],
  resetKey?: unknown,
  pageSize: number = PAGE_SIZE
) {
  const [visibleCount, setVisibleCount] = useState<number>(pageSize);

  const prevResetKeyRef = useRef(resetKey);
  const prevItemsLengthRef = useRef(items.length);
  const prevPageSizeRef = useRef(pageSize);

  // Single consolidated effect to reset pagination without redundant updates
  useEffect(() => {
    const isResetKeyChanged = resetKey !== prevResetKeyRef.current;
    const isPageSizeChanged = pageSize !== prevPageSizeRef.current;
    const isItemsLengthChanged =
      resetKey === undefined && items.length !== prevItemsLengthRef.current;

    prevResetKeyRef.current = resetKey;
    prevItemsLengthRef.current = items.length;
    prevPageSizeRef.current = pageSize;

    if (isResetKeyChanged || isPageSizeChanged || isItemsLengthChanged) {
      setVisibleCount(pageSize);
    }
  }, [resetKey, items.length, pageSize]);

  const paginatedItems = useMemo(() => {
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

  const hasMore = visibleCount < items.length;

  const loadMore = () => {
    setVisibleCount((prev) => Math.min(prev + pageSize, items.length));
  };

  const resetPagination = () => {
    setVisibleCount(pageSize);
  };

  return {
    items: paginatedItems,
    hasMore,
    loadMore,
    totalCount: items.length,
    visibleCount: Math.min(visibleCount, items.length),
    resetPagination,
  };
}

