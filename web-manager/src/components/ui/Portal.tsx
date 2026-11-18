// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into document.body. Overlays (Modal, Drawer, dropdowns)
 * go through here so a click inside them never bubbles into the card/row
 * that opened them, and no `overflow-hidden` ancestor can clip them.
 * Renders nothing on the server and on the first client pass (no mismatch).
 *
 * React still bubbles synthetic events from a portal to its React parent,
 * so the wrapper stops click/pointer/key propagation — otherwise a click on
 * a modal button would also fire the order card's `onClick` underneath.
 */
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      style={{ display: 'contents' }}
      onClick={stop}
      onMouseDown={stop}
      onPointerDown={stop}
      onKeyDown={stop}
      onDoubleClick={stop}
    >
      {children}
    </div>,
    document.body
  );
}
