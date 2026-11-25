import React from 'react';
import { useSessionStore } from '../../store/session';
import { Tooltip } from '../../components/Tooltip';
import { levelColor } from '../../store/usage';

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);

/**
 * How full the model's context window is for the open chat, as the CLI
 * reports it after each step. Hidden until the CLI has reported once.
 */
export const ContextChip: React.FC = () => {
  const s = useSessionStore((st) => st.activeSession);
  if (!s || !s.contextSize) return null;
  const used = s.contextUsed ?? 0;
  const frac = Math.min(1, used / s.contextSize);
  const color = levelColor(1 - frac);
  return (
    <Tooltip side="bottom" content={`Context window: ${fmt(used)} of ${fmt(s.contextSize)} tokens used. Run /compact in the chat to free space.`}>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-[11px] text-[var(--anchor-text-muted)]">
        <span className="w-8 h-1.5 rounded-full bg-[var(--anchor-surface)] overflow-hidden">
          <span className="block h-full rounded-full" style={{ width: `${Math.max(4, frac * 100)}%`, backgroundColor: color }} />
        </span>
        <span className="font-mono">{Math.round(frac * 100)}% ctx</span>
      </div>
    </Tooltip>
  );
};
