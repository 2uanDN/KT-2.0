import { create } from 'zustand';
import { tagService } from '../services/TagService';

export type TypeFilter = 'all' | 'pinned' | 'note' | 'file' | 'link';
export type SortMode = 'savedAt' | 'lastOpenedAt' | 'title';

export interface SortOption {
  id: SortMode;
  label: string;
  desc: string;
}

export const SORT_OPTIONS: readonly SortOption[] = [
  {
    id: 'savedAt',
    label: 'MỚI GIỮ',
    desc: 'Mục được giữ lâu dài gần đây nhất hiển thị trước',
  },
  {
    id: 'lastOpenedAt',
    label: 'MỚI MỞ',
    desc: 'Mục vừa xem gần đây nhất hiển thị trước',
  },
  {
    id: 'title',
    label: 'TIÊU ĐỀ (A-Z)',
    desc: 'Sắp xếp theo thứ tự bảng chữ cái tiếng Việt',
  },
] as const;

export const SORT_LABELS: Record<SortMode, string> = {
  savedAt: 'MỚI GIỮ',
  lastOpenedAt: 'MỚI MỞ',
  title: 'TIÊU ĐỀ (A-Z)',
};

export function getSortLabel(mode: SortMode): string {
  return SORT_LABELS[mode] || 'MỚI GIỮ';
}

interface LibraryState {
  activeTypeFilter: TypeFilter;
  activeTagFilter: string | null;
  sortMode: SortMode;
  searchQuery: string;
  isSearchActive: boolean;

  setTypeFilter: (filter: TypeFilter) => void;
  setTagFilter: (tagId: string | null) => void;
  setSortMode: (mode: SortMode) => void;
  setSearchQuery: (query: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
  clearFilters: () => void;
}

const getInitialSession = <T>(key: string, fallback: T): T => {
  try {
    const val = sessionStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
};

const setSession = (key: string, val: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore session storage errors
  }
};

export const useLibraryStore = create<LibraryState>((set) => ({
  activeTypeFilter: getInitialSession<TypeFilter>('lib_typeFilter', 'all'),
  activeTagFilter: getInitialSession<string | null>('lib_tagFilter', null),
  sortMode: getInitialSession<SortMode>('lib_sortMode', 'savedAt'),
  searchQuery: '',
  isSearchActive: false,

  setTypeFilter: (filter) => {
    setSession('lib_typeFilter', filter);
    set({ activeTypeFilter: filter });
  },

  setTagFilter: (tagId) => {
    setSession('lib_tagFilter', tagId);
    set({ activeTagFilter: tagId });
  },

  setSortMode: (mode) => {
    setSession('lib_sortMode', mode);
    set({ sortMode: mode });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  openSearch: () => {
    set({ isSearchActive: true });
  },

  closeSearch: () => {
    set({ isSearchActive: false, searchQuery: '' });
  },

  clearFilters: () => {
    setSession('lib_typeFilter', 'all');
    setSession('lib_tagFilter', null);
    set({
      activeTypeFilter: 'all',
      activeTagFilter: null,
      searchQuery: '',
    });
  },
}));

// Subscribe to tagService deletions to keep filter state in sync without coupling TagService to the UI store
tagService.onTagDeleted((deletedTagId) => {
  const current = useLibraryStore.getState();
  if (current.activeTagFilter === deletedTagId) {
    current.setTagFilter(null);
  }
});
