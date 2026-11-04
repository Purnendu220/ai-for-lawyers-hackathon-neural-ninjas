import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { RequireAuth, RequireOrg } from './guards';
import { AppShell } from './layouts/AppShell';
import { CaseLayout } from './layouts/CaseLayout';
import { RouteError } from './RouteError';

/** Lazy route: each screen is its own chunk (docs/ARCHITECTURE.md §4.2). */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/login', lazy: page(() => import('@/features/auth/LoginPage')) },
      {
        path: '/invite/:orgId/:inviteId',
        lazy: page(() => import('@/features/team/InvitePage')),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/onboarding',
            lazy: page(() => import('@/features/onboarding/OnboardingPage')),
          },
          {
            element: <RequireOrg />,
            children: [
              {
                element: <AppShell />,
                children: [
                  {
                    path: '/dashboard',
                    lazy: page(() => import('@/features/dashboard/DashboardPage')),
                  },
                  { path: '/cases', lazy: page(() => import('@/features/cases/CasesPage')) },
                  {
                    path: '/cases/new',
                    lazy: page(() => import('@/features/cases/NewCasePage')),
                  },
                  {
                    path: '/cases/:caseId',
                    element: <CaseLayout />,
                    children: [
                      { index: true, element: <Navigate to="overview" replace /> },
                      {
                        path: 'overview',
                        lazy: page(() => import('@/features/cases/CaseOverviewPage')),
                      },
                      {
                        path: 'documents',
                        lazy: page(() => import('@/features/documents/DocumentsPage')),
                      },
                      {
                        path: 'ai-review/:analysisId',
                        lazy: page(() => import('@/features/review/ReviewPage')),
                      },
                      {
                        path: 'timeline',
                        lazy: page(() => import('@/features/timeline/TimelinePage')),
                      },
                      {
                        path: 'tasks',
                        lazy: page(() => import('@/features/tasks/CaseTasksPage')),
                      },
                      {
                        path: 'copilot',
                        lazy: page(() => import('@/features/copilot/CopilotPage')),
                      },
                    ],
                  },
                  { path: '/tasks', lazy: page(() => import('@/features/tasks/TasksPage')) },
                  {
                    path: '/calendar',
                    lazy: page(() => import('@/features/calendar/CalendarPage')),
                  },
                  { path: '/team', lazy: page(() => import('@/features/team/TeamPage')) },
                  {
                    path: '/settings',
                    lazy: page(() => import('@/features/settings/SettingsPage')),
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <RouteError notFound /> },
    ],
  },
]);
