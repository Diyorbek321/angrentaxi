'use client';

import { ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** What actually happens. Name the consequence, not the mechanism. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` for destructive acts, `override` for a deliberate manual intervention. */
  tone?: 'danger' | 'override' | 'default';
  isPending?: boolean;
}

/**
 * Blocking confirmation for destructive and financial actions — the one case
 * that earns an interruption. Replaces `window.confirm()`, which ignores the
 * theme, cannot be translated (its buttons follow the browser's language), and
 * paints an OS dialog in the middle of a branded panel.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Tasdiqlash',
  cancelLabel = 'Bekor qilish',
  tone = 'danger',
  isPending = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" tone={tone}>
      <div className="space-y-4">
        {description && <div className="text-sm text-muted">{description}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isPending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
