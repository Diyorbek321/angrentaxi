// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
'use client';

import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { Field, controlBase, controlBorder, describedBy } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  wrapperClassName?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, wrapperClassName, className, id, required, ...props }, ref) => {
    const auto = useId();
    const areaId = id ?? auto;
    return (
      <Field id={areaId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
        <textarea
          ref={ref}
          id={areaId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(areaId, error, hint)}
          className={cn(controlBase, controlBorder(!!error), 'px-2.5 py-1.5 resize-y min-h-[72px]', className)}
          {...props}
        />
      </Field>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
