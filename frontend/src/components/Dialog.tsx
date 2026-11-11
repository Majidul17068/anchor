import React, { useEffect, useRef } from 'react';
import { cn } from '../lib/cn';
import { X } from 'lucide-react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  className,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        className={cn(
          'w-full bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] rounded-xl shadow-modal overflow-hidden flex flex-col max-h-[90vh]',
          widths[maxWidth],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-[var(--anchor-border)]">
          <div className="flex flex-col gap-0.5 text-left">
            <h3 id="dialog-title" className="text-base font-semibold text-[var(--anchor-text)]">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] p-1 rounded-md hover:bg-[var(--anchor-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 text-left">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 p-3 bg-[var(--anchor-surface)] border-t border-[var(--anchor-border)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
