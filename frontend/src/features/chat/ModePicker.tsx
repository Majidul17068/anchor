import React from 'react';
import type { Mode } from '../../bridge/types';
import { useSessionStore } from '../../store/session';
import { CheckSquare, Compass, Play, ShieldQuestion } from 'lucide-react';

export const ModePicker: React.FC = () => {
  const activeSession = useSessionStore((s) => s.activeSession);
  const updateSession = useSessionStore((s) => s.updateSession);

  if (!activeSession) return null;

  const modes: { value: Mode; label: string; icon: React.ReactNode }[] = [
    { value: 'default', label: 'Ask First', icon: <ShieldQuestion className="w-3.5 h-3.5" /> },
    { value: 'plan', label: 'Plan First', icon: <Compass className="w-3.5 h-3.5" /> },
    { value: 'auto', label: 'Auto Pilot', icon: <Play className="w-3.5 h-3.5" /> },
    { value: 'accept-edits', label: 'Review Edits', icon: <CheckSquare className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex items-center gap-1.5 bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-md px-2 py-1 text-xs">
      <select
        aria-label="Select execution mode"
        value={activeSession.mode}
        onChange={(e) => updateSession(activeSession.id, { mode: e.target.value as Mode })}
        className="bg-transparent text-[var(--anchor-text)] text-xs focus:outline-none cursor-pointer pr-1"
      >
        {modes.map((m) => (
          <option key={m.value} value={m.value} className="bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)]">
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
};
