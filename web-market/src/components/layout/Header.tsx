'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Bell, Volume2, VolumeX, LogOut, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhone, initials } from '@/lib/format';
import { STORE_STATUS_LABEL } from '@/lib/orderStatus';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { Store, VendorUser } from '@/lib/api';

export interface HeaderProps {
  title: string;
  subtitle: string;
  store: Store | null;
  user: VendorUser | null;
  newOrdersCount: number;
  chimeEnabled: boolean;
  onToggleChime: (next: boolean) => void;
  onLogout: () => void;
}

export function Header({
  title,
  subtitle,
  store,
  user,
  newOrdersCount,
  chimeEnabled,
  onToggleChime,
  onLogout,
}: HeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/dashboard/products?q=${encodeURIComponent(q)}`);
  };

  const isOpen = store?.status !== 'closed';

  return (
    <header className="h-16 shrink-0 border-b border-line bg-surface flex items-center gap-4 px-5">
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-bold tracking-tight text-ink truncate">{title}</h1>
        <p className="text-xs text-muted truncate">{subtitle}</p>
      </div>

      {/* Store status. Read-only: the vendor API exposes no way to open or
          close the store — see the note in the PR description. */}
      <div
        className={cn(
          'hidden xl:flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-medium',
          isOpen
            ? 'border-primary/30 bg-primary/10 text-primary-700 dark:text-primary-300'
            : 'border-line bg-surface-2 text-muted'
        )}
        title={store ? `${store.name} — ${STORE_STATUS_LABEL[store.status]}` : undefined}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', isOpen ? 'bg-primary' : 'bg-line-strong')} />
        {STORE_STATUS_LABEL[store?.status ?? 'active']}
        {store && (
          <>
            <span className="text-subtle">·</span>
            <Clock size={12} className="text-subtle" />
            <span className="font-mono tabular-nums">
              {store.workingHoursStart}–{store.workingHoursEnd}
            </span>
          </>
        )}
      </div>

      <form onSubmit={submitSearch} className="hidden lg:block relative w-56">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mahsulot qidirish..."
          aria-label="Mahsulot qidirish"
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-2 border border-line text-sm text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
        />
      </form>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onToggleChime(!chimeEnabled)}
          title={chimeEnabled ? "Ovozni o'chirish" : 'Ovozni yoqish'}
          aria-label={chimeEnabled ? "Ovozni o'chirish" : 'Ovozni yoqish'}
          aria-pressed={chimeEnabled}
          className={cn(
            'h-9 w-9 inline-flex items-center justify-center rounded-lg border transition-colors',
            chimeEnabled
              ? 'border-primary/30 bg-primary/10 text-primary-600 dark:text-primary-300'
              : 'border-line bg-surface text-muted hover:text-ink hover:bg-surface-2'
          )}
        >
          {chimeEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <Link
          href="/dashboard/orders"
          title={
            newOrdersCount > 0 ? `${newOrdersCount} ta yangi buyurtma` : 'Yangi buyurtma yo‘q'
          }
          aria-label={
            newOrdersCount > 0 ? `${newOrdersCount} ta yangi buyurtma` : 'Yangi buyurtma yo‘q'
          }
          className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line bg-surface text-muted hover:text-ink hover:bg-surface-2 transition-colors"
        >
          <Bell size={16} />
          {newOrdersCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-ink text-2xs font-bold font-mono flex items-center justify-center ring-2 ring-surface">
              {newOrdersCount > 9 ? '9+' : newOrdersCount}
            </span>
          )}
        </Link>

        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Profil menyusi"
            className="h-9 w-9 rounded-lg bg-primary/12 border border-primary/25 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center hover:bg-primary/20 transition-colors"
          >
            {initials(user?.firstName, user?.lastName)}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-line bg-surface shadow-pop p-1.5 animate-slide-up"
            >
              <div className="px-2.5 py-2 border-b border-line mb-1">
                <p className="text-sm font-semibold text-ink truncate">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Sotuvchi'}
                </p>
                <p className="text-xs text-muted font-mono mt-0.5">{formatPhone(user?.phone)}</p>
              </div>
              <Link
                href="/dashboard/settings"
                onClick={() => setMenuOpen(false)}
                role="menuitem"
                className="block px-2.5 py-2 rounded-lg text-sm text-muted hover:text-ink hover:bg-surface-2 transition-colors"
              >
                Sozlamalar
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <LogOut size={15} />
                Chiqish
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
