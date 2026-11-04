import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    // Fail immediately when offline instead of pausing: writes to legal records are never queued
    // silently (docs/ARCHITECTURE.md §4.6).
    mutations: { retry: 0, networkMode: 'always' },
  },
});
