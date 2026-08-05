'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authStorage } from '@/lib/auth';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Faqat yo'naltirish sahifasi. Spinner o'rniga skelet — panelning qolgan
 * qismidagi yuklash tili bilan bir xil.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(authStorage.isAuthenticated() ? '/dashboard' : '/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div role="status" aria-live="polite" className="w-full max-w-sm flex flex-col items-center gap-3">
        <span className="sr-only">Yo‘naltirilmoqda</span>
        <Skeleton className="h-14 w-14 rounded-ds-md" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}
