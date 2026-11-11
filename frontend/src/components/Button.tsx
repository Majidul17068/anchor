import React from 'react';
import { cn } from '../lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      icon,
      iconPosition = 'left',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--anchor-ring)] disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer';

    const variants = {
      primary:
        'bg-[var(--anchor-accent)] hover:bg-[var(--anchor-accent-hover)] active:bg-[var(--anchor-accent-active)] text-white shadow-sm',
      accent:
        'bg-[var(--anchor-accent)] hover:bg-[var(--anchor-accent-hover)] text-white shadow-sm',
      secondary:
        'bg-[var(--anchor-surface-elevated)] hover:bg-[var(--anchor-surface-hover)] active:bg-[var(--anchor-surface-active)] text-[var(--anchor-text)] border border-[var(--anchor-border)]',
      outline:
        'bg-transparent hover:bg-[var(--anchor-surface-hover)] text-[var(--anchor-text)] border border-[var(--anchor-border)]',
      ghost:
        'bg-transparent hover:bg-[var(--anchor-surface-hover)] text-[var(--anchor-text-muted)] hover:text-[var(--anchor-text)]',
      danger:
        'bg-[var(--anchor-danger)] hover:bg-[var(--anchor-danger-hover)] text-white shadow-sm',
    };

    const sizes = {
      xs: 'text-xs px-2 py-1 gap-1.5',
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-3.5 py-2 gap-2',
      lg: 'text-base px-4 py-2.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : (
          icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
        )}
        {children}
        {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
