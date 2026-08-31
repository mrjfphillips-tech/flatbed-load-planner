/**
 * Application router configuration using React Router v6.
 * Defines routes and wraps them with the responsive Layout shell.
 */
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import App from './App';

// Lazy-loaded route placeholders (to be implemented in later tasks)
const SessionPage = React.lazy(() =>
  import('./pages/SessionPage').then((m) => ({ default: m.SessionPage }))
);
const ManagerPage = React.lazy(() =>
  import('./pages/ManagerPage').then((m) => ({ default: m.ManagerPage }))
);
const AdminPage = React.lazy(() =>
  import('./pages/AdminPage').then((m) => ({ default: m.AdminPage }))
);
const FlatbedPlannerPage = React.lazy(() =>
  import('./pages/FlatbedPlannerPage').then((m) => ({ default: m.FlatbedPlannerPage }))
);
const FleetPlannerPage = React.lazy(() =>
  import('./pages/FleetPlannerPage').then((m) => ({ default: m.FleetPlannerPage }))
);

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[200px]">
          <span className="text-ptv-text3">Loading...</span>
        </div>
      }
    >
      {children}
    </React.Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <App />,
      },
      {
        path: 'session',
        element: (
          <SuspenseWrapper>
            <SessionPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'manager',
        element: (
          <SuspenseWrapper>
            <ManagerPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin',
        element: (
          <SuspenseWrapper>
            <AdminPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'flatbed',
        element: (
          <SuspenseWrapper>
            <FlatbedPlannerPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'fleet',
        element: (
          <SuspenseWrapper>
            <FleetPlannerPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
