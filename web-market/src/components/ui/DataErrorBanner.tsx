'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

/**
 * Yangilash muvaffaqiyatsiz bo'lganda, lekin OXIRGI YAXSHI MA'LUMOT hali
 * ekranda turganda ko'rsatiladigan banner. Jimgina eski ma'lumotni "jonli"
 * deb ko'rsatish — panelga ishonchni bir martada yo'qotadigan xato; banner
 * eskirganini nomlaydi va qayta urinish beradi, ma'lumotni esa olib qo'ymaydi.
 */
export function DataErrorBanner({
  message,
  onRetry,
  retrying = false,
  className,
}: {
  message?: string | null;
  onRetry: () => void | Promise<void>;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={
        'mb-4 flex flex-wrap items-center gap-3 rounded-ds-sm border border-override/40 bg-override-tint px-3.5 py-2.5 ' +
        (className ?? '')
      }
    >
      <AlertTriangle
        size={16}
        aria-hidden
        className="shrink-0 text-override-dark dark:text-override-light"
      />
      <div className="min-w-0 flex-1">
        <p className="text-caption font-bold text-override-dark dark:text-override-light">
          Yangilab bo&apos;lmadi — oxirgi muvaffaqiyatli ma&apos;lumot ko&apos;rsatilmoqda
        </p>
        {message && <p className="mt-0.5 truncate text-caption text-muted">{message}</p>}
      </div>
      <Button
        variant="secondary"
        size="sm"
        isLoading={retrying}
        onClick={() => void onRetry()}
        leftIcon={<RefreshCw size={12} aria-hidden />}
      >
        Qayta urinish
      </Button>
    </div>
  );
}
