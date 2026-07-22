'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

// Kitchen Screen kiosk mode — an always-on display with no sidebar/header,
// just the order kanban. Toggled from the Orders page, consumed by the
// dashboard layout to hide its own chrome.
interface KioskContextValue {
  kiosk: boolean;
  setKiosk: (v: boolean) => void;
}

const KioskContext = createContext<KioskContextValue>({ kiosk: false, setKiosk: () => {} });

export function KioskProvider({ children }: { children: ReactNode }) {
  const [kiosk, setKiosk] = useState(false);
  return <KioskContext.Provider value={{ kiosk, setKiosk }}>{children}</KioskContext.Provider>;
}

export function useKiosk(): KioskContextValue {
  return useContext(KioskContext);
}
