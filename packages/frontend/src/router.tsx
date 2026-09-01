/**
 * Application router — OptiFlow Flatbed Steel Load Planner
 */
import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

const FlatbedPlannerPage = React.lazy(() =>
  import('./pages/FlatbedPlannerPage').then((m) => ({ default: m.FlatbedPlannerPage }))
);
const FleetPlannerPage = React.lazy(() =>
  import('./pages/FleetPlannerPage').then((m) => ({ default: m.FleetPlannerPage }))
);
const LoadDiagramPage = React.lazy(() =>
  import('./pages/LoadDiagramPage').then((m) => ({ default: m.LoadDiagramPage }))
);

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[200px]">
          <span className="text-gray-500">Loading...</span>
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
    element: <Navigate to="/flatbed" replace />,
  },
  {
    path: '/flatbed',
    element: (
      <SuspenseWrapper>
        <FlatbedPlannerPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/fleet',
    element: (
      <SuspenseWrapper>
        <FleetPlannerPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/load-diagram',
    element: (
      <SuspenseWrapper>
        <LoadDiagramPage />
      </SuspenseWrapper>
    ),
  },
]);

export function AppRouter(): React.ReactElement {
  return <RouterProvider router={router} />;
}
