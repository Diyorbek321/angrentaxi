'use client';

import type { ReactNode } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonForm } from '@/components/ui/Skeleton';

export interface SettingsSectionProps {
  title: string;
  description?: ReactNode;
  /** Sarlavha o'ngida (holat badge'i). */
  badge?: ReactNode;
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  onRetry: () => void | Promise<void>;
  skeletonFields?: number;
  dirty: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
  children: ReactNode;
}

/**
 * Bitta sozlamalar kartasi: skeleton → xato+qayta urinish → forma va
 * "Saqlanmagan o'zgarish bor" pastki qatori. Har karta alohida saqlanadi.
 */
export function SettingsSection({
  title,
  description,
  badge,
  loading,
  error,
  hasLoaded,
  onRetry,
  skeletonFields = 3,
  dirty,
  saving,
  onReset,
  onSave,
  children,
}: SettingsSectionProps) {
  const fullError = error && !loading && !hasLoaded;
  return (
    <Card padding="none">
      <CardHeader title={title} description={description} actions={badge} divider />
      {fullError ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <>
          <CardBody className="space-y-4 pt-4">
            {error && hasLoaded && (
              <RetryBanner message={error} onRetry={onRetry} keepsLastData retrying={loading} />
            )}
            {!hasLoaded ? <SkeletonForm fields={skeletonFields} /> : children}
          </CardBody>
          <CardFooter className="justify-between">
            <span className="text-xs text-muted" aria-live="polite">
              {dirty ? 'Saqlanmagan oʻzgarish bor' : 'Barcha oʻzgarishlar saqlangan'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={!dirty || saving} onClick={onReset}>
                Bekor qilish
              </Button>
              <Button
                onClick={onSave}
                isLoading={saving}
                disabled={!hasLoaded || !dirty}
                leftIcon={<Save size={14} aria-hidden="true" />}
              >
                Saqlash
              </Button>
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
