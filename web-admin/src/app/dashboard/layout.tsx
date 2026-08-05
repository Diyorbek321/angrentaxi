'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    // Spinner emas — panel skeleti (yon menyu + yuqori bar + kontent), shunda
    // sessiya tekshirilgach hech narsa joyidan siljimaydi.
    return (
      <div className="flex h-screen overflow-hidden bg-bg" aria-busy="true" aria-live="polite">
        <div className="hidden w-64 shrink-0 border-r border-line bg-surface p-4 lg:block">
          <Skeleton className="h-10 w-40 rounded-ds-sm" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-ds-sm" />
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="h-16 border-b border-line bg-surface" />
          <div className="flex-1 space-y-4 p-4 sm:p-6">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-64 w-full rounded-ds-md" />
          </div>
        </div>
        <span className="sr-only">Yuklanmoqda…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-bg">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
