import React from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, iconPosition = 'left', error, label, id, ...props }, ref) => {
    const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={generatedId} className="text-xs font-medium text-[var(--anchor-text-muted)] select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 pointer-events-none text-[var(--anchor-text-subtle)] flex items-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={generatedId}
            className={cn(
              'w-full bg-[var(--anchor-surface-sunken)] text-[var(--anchor-text)] placeholder-[var(--anchor-text-subtle)] text-sm rounded-lg border border-[var(--anchor-border)] py-2 px-3 transition-colors focus:border-[var(--anchor-border-focus)] focus:ring-1 focus:ring-[var(--anchor-border-focus)] focus:outline-none disabled:opacity-50',
              icon && iconPosition === 'left' && 'pl-9',
              icon && iconPosition === 'right' && 'pr-9',
              error && 'border-[var(--anchor-danger)] focus:border-[var(--anchor-danger)] focus:ring-[var(--anchor-danger)]',
              className
            )}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 pointer-events-none text-[var(--anchor-text-subtle)] flex items-center">
              {icon}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-[var(--anchor-danger)]">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
