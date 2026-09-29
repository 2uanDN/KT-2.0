/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ErrorBoundary } from './components/feedback/ErrorBoundary';
import { ScreenErrorView } from './components/feedback/ScreenErrorView';

export default function App() {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <ScreenErrorView
          error={error}
          onReset={reset}
          screenTitle="Ứng dụng Kho Tri Thức"
          isRoot
        />
      )}
    >
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
