import type { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/components/ui/cn';

export interface NoticeProps {
  /** `info` — tushuntirish; `danger` — jonli tizimga ta'sir (bloklash). Amber — faqat qo'lda aralashuv uchun, bu yerda yo'q. */
  tone?: 'info' | 'danger' | 'neutral';
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TONES = {
  info: 'border-info/25 bg-info-tint text-info-dark dark:text-info-light',
  danger: 'border-danger/30 bg-danger-tint text-danger-dark dark:text-danger-light',
  neutral: 'border-line bg-surface-2 text-muted',
} as const;

/** Kartadagi izoh qatori (kitda Alert yo'q — global-settings'dagi naqsh). */
export function Notice({ tone = 'info', title, children, className }: NoticeProps) {
  const Icon = tone === 'danger' ? AlertTriangle : Info;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cn('flex items-start gap-2 rounded-ds-sm border px-3 py-2', TONES[tone], className)}
    >
      <Icon size={15} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-xs leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
