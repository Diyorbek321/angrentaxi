'use client';

import { Bell, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/lib/utils';
import { useSidebar } from '@/components/layout/SidebarContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const { toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#080D1A]/90 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile menu toggle + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-slate-400 transition-colors hover:border-yellow-400/30 hover:text-yellow-400 hover:bg-yellow-400/5 lg:hidden"
          aria-label="Menyuni ochish"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-slate-400 transition-colors hover:border-yellow-400/30 hover:text-yellow-400 hover:bg-yellow-400/5"
        >
          <Bell className="h-4 w-4" />
        </button>

        {user && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-[#080D1A] shadow-glow-yellow-sm">
              {getInitials(user.firstName || 'A', user.lastName || 'D')}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-500">Administrator</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
