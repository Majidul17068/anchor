import React from 'react';
import { cn } from '../lib/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pills';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeId,
  onChange,
  variant = 'underline',
  className,
}) => {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 select-none',
        variant === 'underline' ? 'border-b border-[var(--anchor-border)]' : 'bg-[var(--anchor-surface-sunken)] p-1 rounded-lg border border-[var(--anchor-border)]',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--anchor-ring)]',
              variant === 'underline'
                ? isActive
                  ? 'text-[var(--anchor-text)] font-semibold border-b-2 border-[var(--anchor-accent)] -mb-[1px] rounded-b-none'
                  : 'text-[var(--anchor-text-muted)] hover:text-[var(--anchor-text)]'
                : isActive
                ? 'bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)] shadow-xs font-semibold'
                : 'text-[var(--anchor-text-muted)] hover:text-[var(--anchor-text)]'
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                  isActive
                    ? 'bg-[var(--anchor-accent)]/20 text-[var(--anchor-accent)]'
                    : 'bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text-subtle)]'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
