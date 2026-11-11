import React, { useState } from 'react';
import { cn } from '../lib/cn';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  className,
}) => {
  const [visible, setVisible] = useState(false);

  if (!content) return <>{children}</>;

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)] text-[11px] font-medium rounded-md shadow-dropdown border border-[var(--anchor-border)] whitespace-nowrap pointer-events-none animate-in fade-in duration-100',
            positions[side],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};
