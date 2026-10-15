'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface KioskFrameProps {
  title: string;
  /** Yagona jonli holat ko'rsatkichi (PollStatus). */
  status: ReactNode;
  openToggle: ReactNode;
  banner?: ReactNode;
  onExit: () => void;
  children: ReactNode;
}

function useClock(): string {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('uz-UZ', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

/**
 * Oshxona ekrani: devorga osilgan planshet uchun to'liq ekran. Sidebar va
 * topbar yo'q — faqat soat, aloqa holati, Ochiq/Yopiq va navbatning o'zi.
 */
export function KioskFrame({ title, status, openToggle, banner, onExit, children }: KioskFrameProps) {
  const clock = useClock();
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg text-ink">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
        <span className="truncate text-h2 text-ink">{title}</span>
        {status}
        <div className="flex-1" />
        <span className="num hidden text-h1 text-ink sm:inline" aria-hidden>
          {clock}
        </span>
        {openToggle}
        <Button variant="secondary" size="lg" leftIcon={<Minimize2 size={16} />} onClick={onExit}>
          Kioskdan chiqish
        </Button>
      </header>
      {banner}
      <main id="main" className="flex-1 overflow-y-auto p-4 sm:p-5">
        {children}
      </main>
    </div>
  );
}
