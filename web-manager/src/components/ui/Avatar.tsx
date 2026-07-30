import { clsx } from 'clsx';

export interface AvatarProps {
  name?: string | null;
  size?: 'xs' | 'sm' | 'md';
  /** Busy drivers render grey, free ones mint — same rule as the map pins. */
  tone?: 'mint' | 'muted';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
};

function initials(name?: string | null): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '—';
}

export function Avatar({ name, size = 'sm', tone = 'mint', className }: AvatarProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none',
        sizeClasses[size],
        tone === 'mint'
          ? 'bg-primary/15 text-primary-700 dark:text-primary-300'
          : 'bg-surface-3 text-muted',
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
