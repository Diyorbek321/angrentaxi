// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Number of dialogs currently open — the body scroll lock is reference-counted. */
let openCount = 0;

/**
 * Keyboard behaviour shared by Modal, Drawer and ConfirmDialog:
 *  - Escape closes (only the top-most dialog — capture + stopPropagation);
 *  - focus moves into the dialog and Tab cannot escape it (focus trap);
 *  - on close, focus returns to the element that opened it;
 *  - the page behind does not scroll.
 *
 * `onClose` is read through a ref, so an inline arrow from the caller does
 * not re-run the effect (and steal focus) on every render.
 */
export function useDialog<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement as HTMLElement | null;
    openCount += 1;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const node = ref.current;
    const autoFocus = node?.querySelector<HTMLElement>('[data-autofocus]');
    const first = autoFocus ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = ref.current;
      if (!current) return;
      // Only the dialog that holds focus reacts — nested dialogs stay sane.
      if (!current.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstItem || active === current)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = previousOverflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  return ref;
}
