import React from 'react';
import { cn } from '../lib/cn';

export interface SidebarProps {
  children: React.ReactNode;
  width?: string;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  children,
  width = 'w-72',
  className,
}) => {
  return (
    <aside
      aria-label="Context sidebar"
      className={cn(
        'bg-[var(--anchor-surface)] border-r border-[var(--anchor-border)] flex flex-col h-full overflow-hidden shrink-0 z-10 select-none text-left',
        width,
        className
      )}
    >
      {children}
    </aside>
  );
};
