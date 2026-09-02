'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { applySidebarCollapsed, getStoredSidebarCollapsed } from '@/lib/sidebar-state';

/**
 * Desktop rail holatining manbai — <html> dagi `sidebar-collapsed` klassi.
 * Uni layout.tsx dagi pre-paint SIDEBAR_INIT_SCRIPT qo'yadi, shuning uchun
 * birinchi kadrdan boshlab kenglik to'g'ri (miltillash yo'q). Sidebar daraxti
 * autentifikatsiyadan keyin, faqat mijoz tomonida mount bo'ladi — lazy
 * useState initsializatorida klassni o'qish gidratatsiya nomuvofiqligi bermaydi.
 */
interface SidebarContextValue {
  /** Mobil overlay ochiq-yopiqligi. */
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Desktop ikon-rail rejimi (~64px). Hech qachon nolga yig'ilmaydi. */
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(getStoredSidebarCollapsed);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      applySidebarCollapsed(next);
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((prev) => !prev),
        isCollapsed,
        toggleCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return ctx;
}
