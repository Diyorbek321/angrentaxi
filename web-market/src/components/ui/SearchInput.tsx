// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './cn';
import { controlBase, controlBorder } from './Field';
import { Kbd } from './Kbd';
import { kitT } from '@/lib/i18n/kit-messages';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  /** Shows a clear (×) button when there is text. */
  onClear?: () => void;
  /** Keyboard hint shown while empty, e.g. "⌘K" or "/". */
  shortcut?: string;
  size?: 'sm' | 'md';
  wrapperClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      shortcut,
      size = 'md',
      placeholder,
      wrapperClassName,
      className,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const clear = onClear ?? (() => onChange(''));
    const hint = placeholder ?? kitT().common.search;
    return (
      <div className={cn('relative flex items-center min-w-0', wrapperClassName)}>
        <Search size={15} aria-hidden className="absolute left-2.5 text-subtle pointer-events-none" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hint}
          aria-label={ariaLabel ?? hint}
          className={cn(
            controlBase,
            controlBorder(false),
            size === 'sm' ? 'h-7 text-[13px]' : 'h-8',
            'pl-8 pr-8 [&::-webkit-search-cancel-button]:appearance-none',
            className
          )}
          {...props}
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label={kitT().common.clearSearch}
            className="absolute right-1.5 h-5 w-5 inline-flex items-center justify-center rounded-ds-xs text-subtle hover:text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X size={13} aria-hidden />
          </button>
        ) : shortcut ? (
          <Kbd className="absolute right-1.5 pointer-events-none">{shortcut}</Kbd>
        ) : null}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';
