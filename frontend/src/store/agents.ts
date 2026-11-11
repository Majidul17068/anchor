import { create } from 'zustand';
import type { Agent, Model } from '../bridge/types';
import { getBridge } from '../bridge';

interface AgentsState {
  agents: Agent[];
  models: Model[];
  activeAgent: Agent | null;
  loading: boolean;
  filterSource: string | null;

  setFilterSource: (src: string | null) => void;
  loadAgents: () => Promise<void>;
  selectAgent: (id: string) => Promise<void>;
  saveAgent: (agent: Omit<Agent, 'id' | 'source'> & { id?: string }) => Promise<Agent>;
  deleteAgent: (id: string) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  models: [],
  activeAgent: null,
  loading: false,
  filterSource: null,

  setFilterSource: (src) => set({ filterSource: src }),

  loadAgents: async () => {
    try {
      set({ loading: true });
      const bridge = getBridge();
      const [agentsList, modelsList] = await Promise.all([bridge.agents.list(), bridge.models.list()]);
      set({
        agents: agentsList,
        models: modelsList,
        activeAgent: get().activeAgent || agentsList[0] || null,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  selectAgent: async (id: string) => {
    const bridge = getBridge();
    const ag = await bridge.agents.get(id);
    set({ activeAgent: ag });
  },

  saveAgent: async (input) => {
    const bridge = getBridge();
    const saved = await bridge.agents.save(input);
    await get().loadAgents();
    set({ activeAgent: saved });
    return saved;
  },

  deleteAgent: async (id: string) => {
    const bridge = getBridge();
    await bridge.agents.delete(id);
    await get().loadAgents();
  },
}));
