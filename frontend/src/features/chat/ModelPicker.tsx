import React, { useEffect, useState } from 'react';
import type { Model } from '../../bridge/types';
import { getBridge } from '../../bridge';
import { useSessionStore } from '../../store/session';
import { Cpu } from 'lucide-react';

export const ModelPicker: React.FC = () => {
  const activeSession = useSessionStore((s) => s.activeSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      const bridge = getBridge();
      const list = await bridge.models.list();
      setModels(list);
    };
    fetchModels();
  }, []);

  if (!activeSession) return null;

  return (
    <div className="flex items-center gap-1.5 bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-md px-2 py-1 text-xs">
      <Cpu className="w-3.5 h-3.5 text-[var(--anchor-accent)] shrink-0" />
      <select
        aria-label="Select model"
        value={activeSession.modelId}
        onChange={(e) => updateSession(activeSession.id, { modelId: e.target.value })}
        className="bg-transparent text-[var(--anchor-text)] text-xs focus:outline-none cursor-pointer pr-1"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id} className="bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text)]">
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
};
