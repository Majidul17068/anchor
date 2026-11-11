import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ThinkingBlockProps {
  text: string;
  className?: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ text, className }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)]/60 text-xs text-left overflow-hidden my-2',
        className
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--anchor-accent)]" />
          <span className="font-medium text-[11px] uppercase tracking-wider">
            Reasoning Chain
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span>{expanded ? 'Hide thoughts' : 'Show thoughts'}</span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 text-[var(--anchor-text-muted)] text-[11px] leading-relaxed border-t border-[var(--anchor-border-subtle)] font-mono whitespace-pre-wrap selectable bg-[var(--anchor-surface-sunken)]">
          {text}
        </div>
      )}
    </div>
  );
};
