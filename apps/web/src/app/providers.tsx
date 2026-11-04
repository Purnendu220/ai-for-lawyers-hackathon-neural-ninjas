import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/query';
import { UpdatePrompt } from '@/pwa/UpdatePrompt';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster position="top-center" richColors closeButton />
      <UpdatePrompt />
    </QueryClientProvider>
  );
}
