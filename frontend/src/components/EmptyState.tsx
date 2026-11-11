import React from 'react';
import { cn } from '../lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const AnchorGlyph: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('text-[var(--anchor-accent)]', className)}
  >
    <circle cx="12" cy="5" r="3" />
    <line x1="12" y1="8" x2="12" y2="21" />
    <line x1="5" y1="12" x2="19" y2="12" />
    <path d="M5 12a7 7 0 0 0 14 0" />
  </svg>
);

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center mb-4 text-[var(--anchor-accent)] shadow-xs">
        {icon || <AnchorGlyph size={28} />}
      </div>
      <h4 className="text-sm font-semibold text-[var(--anchor-text)] mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
