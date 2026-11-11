import React from 'react';
import { cn } from '../lib/cn';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { value: string; label: string; disabled?: boolean }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, children, id, ...props }, ref) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={generatedId} className="text-xs font-medium text-[var(--anchor-text-muted)] select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={generatedId}
            className={cn(
              'w-full appearance-none bg-[var(--anchor-surface-sunken)] text-[var(--anchor-text)] text-sm rounded-lg border border-[var(--anchor-border)] py-2 pl-3 pr-8 transition-colors focus:border-[var(--anchor-border-focus)] focus:ring-1 focus:ring-[var(--anchor-border-focus)] focus:outline-none disabled:opacity-50 cursor-pointer',
              error && 'border-[var(--anchor-danger)]',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)]">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute right-2.5 pointer-events-none text-[var(--anchor-text-subtle)]">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <span className="text-xs text-[var(--anchor-danger)]">{error}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
