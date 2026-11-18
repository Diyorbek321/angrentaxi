// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { User } from 'lucide-react';
import { cn } from './cn';
import { initials } from '@/lib/format';

export interface AvatarProps {
  /** Full name; null/empty → a person icon (never "NN"). */
  name?: string | null;
  /** Alternative to `name`. */
  firstName?: string | null;
  lastName?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** `muted` = busy/offline (grey), `mint` = available. */
  tone?: 'mint' | 'muted' | 'neutral';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
} as const;

const iconSize = { xs: 12, sm: 14, md: 16, lg: 18 } as const;

export function Avatar({ name, firstName, lastName, src, size = 'sm', tone = 'neutral', className }: AvatarProps) {
  const text = firstName !== undefined || lastName !== undefined ? initials(firstName, lastName ?? null) : initials(name);
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none overflow-hidden',
        sizeClasses[size],
        tone === 'mint' && 'bg-mint-tint text-primary-text',
        tone === 'muted' && 'bg-surface-3 text-subtle',
        tone === 'neutral' && 'bg-surface-3 text-muted',
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : text ? (
        text
      ) : (
        <User size={iconSize[size]} />
      )}
    </span>
  );
}
