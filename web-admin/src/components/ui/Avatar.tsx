import { cn } from '@/lib/utils';

export interface AvatarProps {
  name?: string | null;
  size?: 'xs' | 'sm' | 'md';
  /** `mint` — aksent tint foni; `muted` — passiv/bloklangan foydalanuvchi. */
  tone?: 'mint' | 'muted';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-caption',
  md: 'h-10 w-10 text-body',
};

function initials(name?: string | null): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '—';
}

export function Avatar({ name, size = 'sm', tone = 'mint', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        sizeClasses[size],
        tone === 'mint' ? 'bg-mint-tint text-primary-text' : 'bg-surface-3 text-muted',
        className
      )}
      // Ism har doim yonidagi matnda ham bor — avatar sof dekorativ.
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
