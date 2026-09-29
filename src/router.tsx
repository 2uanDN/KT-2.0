import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { ScreenErrorBoundary } from './components/feedback/ScreenErrorBoundary';
import { LibraryScreen } from './screens/LibraryScreen';
import { SearchScreen } from './screens/SearchScreen';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { CollectionDetailScreen } from './screens/CollectionDetailScreen';
import { InboxScreen } from './screens/InboxScreen';
import { TagsScreen } from './screens/TagsScreen';
import { TagDetailScreen } from './screens/TagDetailScreen';
import { ItemDetailScreen } from './screens/ItemDetailScreen';
import { EditScreen } from './screens/EditScreen';
import { SaveScreen } from './screens/SaveScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ScreenErrorBoundary isRoot />,
    children: [
      {
        index: true,
        element: <LibraryScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Thư viện" />,
      },
      {
        path: 'search',
        element: <SearchScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Tìm kiếm" />,
      },
      {
        path: 'collections',
        element: <CollectionsScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Bộ sưu tập" />,
      },
      {
        path: 'collections/:id',
        element: <CollectionDetailScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Chi tiết bộ sưu tập" />,
      },
      {
        path: 'inbox',
        element: <InboxScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Hộp thư đến" />,
      },
      {
        path: 'tags',
        element: <TagsScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Thẻ phân loại" />,
      },
      {
        path: 'tags/:id',
        element: <TagDetailScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Chi tiết thẻ" />,
      },
      {
        path: 'items/:id',
        element: <ItemDetailScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Chi tiết mục" />,
      },
      {
        path: 'items/:id/edit',
        element: <EditScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Chỉnh sửa mục" />,
      },
      {
        path: 'save',
        element: <SaveScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Lưu mục mới" />,
      },
      {
        path: 'settings',
        element: <SettingsScreen />,
        errorElement: <ScreenErrorBoundary screenTitle="Cài đặt & Sao lưu" />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
