import React from 'react';
import { cn } from '../lib/cn';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'warn' | 'ok' | 'info' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className,
  icon,
}) => {
  const variants = {
    default: 'bg-[var(--anchor-surface-sunken)] text-[var(--anchor-text-muted)] border border-[var(--anchor-border)]',
    accent: 'bg-[var(--anchor-accent-subtle)] text-[var(--anchor-accent)] border border-[var(--anchor-accent)]/20',
    warn: 'bg-[var(--anchor-warn-subtle)] text-[var(--anchor-warn)] border border-[var(--anchor-warn)]/20',
    ok: 'bg-[var(--anchor-ok-subtle)] text-[var(--anchor-ok)] border border-[var(--anchor-ok)]/20',
    info: 'bg-[var(--anchor-info-subtle)] text-[var(--anchor-info)] border border-[var(--anchor-info)]/20',
    danger: 'bg-[var(--anchor-danger-subtle)] text-[var(--anchor-danger)] border border-[var(--anchor-danger)]/20',
    outline: 'bg-transparent text-[var(--anchor-text-muted)] border border-[var(--anchor-border)]',
  };

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1 font-medium',
    sm: 'text-xs px-2 py-0.5 gap-1.5 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md shrink-0 tracking-wide select-none',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
