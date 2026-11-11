import React from 'react';
import { useAgentsStore } from '../../store/agents';
import { useSessionStore } from '../../store/session';
import { Bot } from 'lucide-react';

export const AgentPicker: React.FC = () => {
  const activeSession = useSessionStore((s) => s.activeSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const agents = useAgentsStore((s) => s.agents);

  if (!activeSession) return null;

  return (
    <div className="flex items-center gap-1.5 bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-md px-2 py-1 text-xs">
      <Bot className="w-3.5 h-3.5 text-[var(--anchor-info)] shrink-0" />
      <select
        aria-label="Select agent"
        value={activeSession.agentId && activeSession.agentId !== 'agent_general' ? activeSession.agentId : ''}
        onChange={(e) => updateSession(activeSession.id, { agentId: e.target.value })}
        className="bg-transparent text-[var(--anchor-text)] text-xs focus:outline-none cursor-pointer pr-1"
      >
        <option value="" className="bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)]">
          Antigravity default
        </option>
        {agents.map((ag) => (
          <option key={ag.id} value={ag.id} className="bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)]">
            {ag.name}
          </option>
        ))}
      </select>
    </div>
  );
};
