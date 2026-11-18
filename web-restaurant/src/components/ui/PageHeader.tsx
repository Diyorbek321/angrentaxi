// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  /** One line of muted meta under the title (13px). Alias: `meta`. */
  description?: ReactNode;
  meta?: ReactNode;
  /** Right side: secondary buttons first, the primary CTA last. */
  actions?: ReactNode;
  /** Only for 3+ level detail pages. */
  breadcrumbs?: Crumb[];
  /**
   * Accepted for backward compatibility and NOT rendered — page headers have
   * no decorative icon tile (PANEL-UI-KIT §4).
   */
  icon?: ReactNode;
  className?: string;
}

/** h1 20px/600 + meta + actions. No icon tile, no divider; content starts 20px below. */
export function PageHeader({ title, description, meta, actions, breadcrumbs, className }: PageHeaderProps) {
  const sub = description ?? meta;
  return (
    <div className={cn('mb-5', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5">
          <ol className="flex items-center gap-1 text-[13px] text-muted min-w-0">
            {breadcrumbs.map((c, i) => (
              <Fragment key={`${c.label}-${i}`}>
                {i > 0 && <ChevronRight size={13} aria-hidden className="text-subtle shrink-0" />}
                <li className="truncate">
                  {c.href ? (
                    <Link href={c.href} className="hover:text-ink transition-colors">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{c.label}</span>
                  )}
                </li>
              </Fragment>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-h1 text-ink truncate">{title}</h1>
          {sub && <div className="text-[13px] text-muted mt-0.5">{sub}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
