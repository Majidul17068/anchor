import React from 'react';
import { cn } from '../lib/cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  className,
  id,
}) => {
  const switchId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      {(label || description) && (
        <div className="flex flex-col text-left">
          {label && (
            <label
              htmlFor={switchId}
              className={cn('text-sm font-medium text-[var(--anchor-text)] cursor-pointer', disabled && 'opacity-50 cursor-not-allowed')}
            >
              {label}
            </label>
          )}
          {description && (
            <span className="text-xs text-[var(--anchor-text-subtle)] leading-relaxed">
              {description}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--anchor-ring)] disabled:cursor-not-allowed disabled:opacity-40',
          checked ? 'bg-[var(--anchor-accent)]' : 'bg-[var(--anchor-border)]'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
};
