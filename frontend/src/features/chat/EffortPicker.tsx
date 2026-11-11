import React from 'react';
import type { Effort } from '../../bridge/types';
import { useSessionStore } from '../../store/session';
import { Sparkles } from 'lucide-react';

export const EffortPicker: React.FC = () => {
  const activeSession = useSessionStore((s) => s.activeSession);
  const updateSession = useSessionStore((s) => s.updateSession);

  if (!activeSession) return null;

  const efforts: { value: Effort; label: string }[] = [
    { value: 'low', label: 'Effort: Low' },
    { value: 'medium', label: 'Effort: Medium' },
    { value: 'high', label: 'Effort: High' },
  ];

  return (
    <div className="flex items-center gap-1.5 bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-md px-2 py-1 text-xs">
      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <select
        aria-label="Select reasoning effort"
        value={activeSession.effort}
        onChange={(e) => updateSession(activeSession.id, { effort: e.target.value as Effort })}
        className="bg-transparent text-[var(--anchor-text)] text-xs focus:outline-none cursor-pointer pr-1"
      >
        {efforts.map((eff) => (
          <option key={eff.value} value={eff.value} className="bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)]">
            {eff.label}
          </option>
        ))}
      </select>
    </div>
  );
};
