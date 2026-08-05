import { clsx } from 'clsx';

export interface AvatarProps {
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** `mint` — brend aksenti (tinted yuza + ink/yashil matn), `muted` — neytral. */
  tone?: 'mint' | 'muted';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-micro',
  sm: 'h-8 w-8 text-caption',
  md: 'h-10 w-10 text-label',
  lg: 'h-12 w-12 text-title',
};

function initials(name?: string | null): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '—';
}

/**
 * Dekorativ: yonida har doim ismning o'zi yoziladi, shuning uchun
 * `aria-hidden` — skrinrider bosh harflarni takrorlamaydi.
 */
export function Avatar({ name, size = 'sm', tone = 'mint', className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex items-center justify-center rounded-full font-extrabold shrink-0 select-none',
        sizeClasses[size],
        tone === 'mint' ? 'bg-mint-tint text-primary-text' : 'bg-surface-3 text-muted',
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
