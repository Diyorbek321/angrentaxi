'use client';

import { Bell, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/components/layout/SidebarContext';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';

const iconButton = cn(
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-sm border border-line text-muted',
  'transition-colors duration-fast hover:border-line-strong hover:bg-surface-2 hover:text-ink',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
);

/**
 * Panelning yuqori bari. Sahifa SARLAVHASI bu yerda emas — u har bir
 * sahifadagi `PageHeader` da, shunda 19 ta sahifada bitta `h1` bo'ladi va
 * sarlavha ikki marta takrorlanmaydi.
 */
export function Header() {
  const { user } = useAuth();
  const { toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={toggle}
        className={cn(iconButton, 'lg:hidden')}
        aria-label="Menyuni ochish"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex flex-1 items-center justify-end gap-3">
        <ThemeToggle />

        <button type="button" className={iconButton} aria-label="Bildirishnomalar">
          <Bell className="h-4 w-4" />
        </button>

        {user && (
          <div className="flex items-center gap-2.5">
            <Avatar name={`${user.firstName ?? ''} ${user.lastName ?? ''}`} size="sm" />
            <div className="hidden sm:block">
              <p className="text-body font-medium text-ink">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-caption text-muted">Administrator</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
