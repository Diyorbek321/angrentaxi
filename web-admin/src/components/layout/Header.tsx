'use client';

import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getInitials } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between px-6 backdrop-blur-md"
      style={{
        background: 'rgba(8,13,26,0.9)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Page title */}
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-slate-400 transition-colors hover:border-yellow-400/30 hover:text-yellow-400 hover:bg-yellow-400/5"
        >
          <Bell className="h-4 w-4" />
        </button>

        {user && (
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-[#080D1A]"
              style={{ boxShadow: '0 0 8px rgba(250,204,21,0.35)' }}
            >
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
