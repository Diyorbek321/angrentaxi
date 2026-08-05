'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authStorage } from '@/lib/auth';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Entry gate. The authoritative check lives in the middleware; this only picks
 * the first client-side destination, so it must not block on a request.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (authStorage.isAuthenticated()) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto w-full max-w-md space-y-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Yuklanmoqda</span>
        <Skeleton className="h-12 w-12 rounded-ds-md" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-44 w-full rounded-ds-lg" />
      </div>
    </div>
  );
}
