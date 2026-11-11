import React from 'react';
import { cn } from '../lib/cn';

export interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export const Kbd: React.FC<KbdProps> = ({ children, className }) => {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-[var(--anchor-surface-sunken)] text-[var(--anchor-text-subtle)] border border-[var(--anchor-border)] shadow-xs select-none',
        className
      )}
    >
      {children}
    </kbd>
  );
};
