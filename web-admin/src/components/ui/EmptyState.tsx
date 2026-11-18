// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import type { ReactNode } from 'react';
import { Inbox, SearchX } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';
import { kitT } from '@/lib/i18n/kit-messages';

export type EmptyStateVariant = 'first-use' | 'cleared' | 'no-results';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Any node — `false`/`undefined` render nothing. */
  action?: ReactNode;
  /**
   * `first-use` — nothing exists yet (explain + CTA);
   * `cleared` — the queue is done (healthy, calm);
   * `no-results` — filters hide everything (offers "Filtrlarni tozalash").
   */
  variant?: EmptyStateVariant;
  /** With `variant="no-results"`: renders the clear-filters button. */
  onClearFilters?: () => void;
  /** `positive` = the empty state means things are going well (≈ `cleared`). */
  tone?: 'neutral' | 'positive';
  compact?: boolean;
  className?: string;
}

/**
 * Empty state inside a card/table. Calm: grey icon, 14px/600 title, muted
 * line, optional action. No illustrations, no coloured tile.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'first-use',
  onClearFilters,
  tone = 'neutral',
  compact = false,
  className,
}: EmptyStateProps) {
  const positive = tone === 'positive' || variant === 'cleared';
  const defaultIcon = variant === 'no-results' ? <SearchX aria-hidden /> : <Inbox aria-hidden />;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-4',
        compact ? 'gap-2 py-8' : 'gap-3 py-14',
        className
      )}
    >
      <div
        aria-hidden
        className={cn(
          'flex items-center justify-center [&_svg]:h-5 [&_svg]:w-5',
          compact ? 'h-9 w-9' : 'h-10 w-10',
          'rounded-full border',
          positive
            ? 'border-mint/40 bg-mint-tint text-primary-text'
            : 'border-line bg-surface-2 text-subtle'
        )}
      >
        {icon ?? defaultIcon}
      </div>
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <div className="text-[13px] text-muted mt-1 leading-relaxed">{description}</div>}
      </div>
      {(action || (variant === 'no-results' && onClearFilters)) && (
        <div className="mt-1 flex items-center gap-2">
          {variant === 'no-results' && onClearFilters && (
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              {kitT().common.clearFilters}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
