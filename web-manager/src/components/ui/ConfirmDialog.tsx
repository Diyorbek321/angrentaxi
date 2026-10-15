// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  /** What actually happens. Name the consequence, not the mechanism. */
  description?: ReactNode;
  /** Optional extra content (e.g. a reason textarea) under the description. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` destructive · `override` deliberate manual intervention · `default` neutral. */
  tone?: 'danger' | 'override' | 'default';
  isPending?: boolean;
  /** Disable confirm (e.g. until a required reason is typed). */
  confirmDisabled?: boolean;
}

/**
 * Blocking confirmation for destructive and financial actions — the one case
 * that earns an interruption. Replaces `window.confirm()`. Rendered through a
 * portal (via Modal), so it never leaks clicks into the card that opened it.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = 'Tasdiqlash',
  cancelLabel = 'Bekor qilish',
  tone = 'danger',
  isPending = false,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const confirmVariant = tone === 'danger' ? 'danger' : tone === 'override' ? 'override' : 'primary';
  return (
    <Modal
      isOpen={isOpen}
      onClose={isPending ? () => undefined : onClose}
      title={title}
      size="sm"
      tone={tone}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => void onConfirm()}
            isLoading={isPending}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <div className="text-sm text-muted">{description}</div>}
      {children && <div className={description ? 'mt-3' : undefined}>{children}</div>}
    </Modal>
  );
}
