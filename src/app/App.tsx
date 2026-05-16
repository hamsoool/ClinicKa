import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './lib/auth';
import { QueryClientProvider } from '@tanstack/react-query';
import { appQueryClient } from './query-client';

export default function App() {
  return (
    <QueryClientProvider client={appQueryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
