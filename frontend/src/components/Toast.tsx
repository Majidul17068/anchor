import React, { useEffect } from 'react';
import { cn } from '../lib/cn';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'info' | 'error' | 'success' | 'warn';
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 4000,
  onClose,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    info: <Info className="w-4 h-4 text-[var(--anchor-info)] shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-[var(--anchor-danger)] shrink-0" />,
    warn: <AlertCircle className="w-4 h-4 text-[var(--anchor-warn)] shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-[var(--anchor-ok)] shrink-0" />,
  };

  const borders = {
    info: 'border-[var(--anchor-info)]/30',
    error: 'border-[var(--anchor-danger)]/30',
    warn: 'border-[var(--anchor-warn)]/30',
    success: 'border-[var(--anchor-ok)]/30',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-3.5 py-2.5 bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)] text-xs rounded-lg shadow-elevated border animate-in slide-in-from-bottom-2 duration-150 max-w-md',
        borders[type]
      )}
    >
      {icons[type]}
      <span className="flex-1 font-medium">{message}</span>
      <button
        onClick={onClose}
        aria-label="Dismiss alert"
        className="text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] ml-1 p-0.5 rounded transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
