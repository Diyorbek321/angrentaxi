'use client';

import type { ReactNode } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { t } from '@/locales';

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
  const c = t().common;
  const s = t().settings;
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
              {dirty ? s.dirty : s.clean}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={!dirty || saving} onClick={onReset}>
                {c.cancel}
              </Button>
              <Button
                onClick={onSave}
                isLoading={saving}
                disabled={!hasLoaded || !dirty}
                leftIcon={<Save size={14} aria-hidden="true" />}
              >
                {c.save}
              </Button>
            </div>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
