import { create } from 'zustand';
import type { Automation, AutomationRun, BackgroundStatus } from '../bridge/types';
import { getBridge } from '../bridge';

interface AutomationsState {
  list: Automation[];
  importable: Automation[];
  runs: Record<string, AutomationRun[]>;
  background: BackgroundStatus | null;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  loadRuns: (id: string) => Promise<void>;
  save: (a: Parameters<ReturnType<typeof getBridge>['automations']['save']>[0]) => Promise<Automation | null>;
  setEnabled: (id: string, on: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  runNow: (id: string) => Promise<void>;
  setBackground: (run: boolean, login: boolean) => Promise<void>;
  clearError: () => void;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useAutomationsStore = create<AutomationsState>((set, get) => ({
  list: [],
  importable: [],
  runs: {},
  background: null,
  loaded: false,
  error: null,

  load: async () => {
    try {
      const b = getBridge().automations;
      const [list, importable, background] = await Promise.all([b.list(), b.importable(), b.background()]);
      set({ list, importable, background, loaded: true });
      // Histories that are open stay current.
      for (const id of Object.keys(get().runs)) void get().loadRuns(id);
    } catch (e) {
      set({ error: msg(e), loaded: true });
    }
  },

  loadRuns: async (id) => {
    try {
      const r = await getBridge().automations.runs(id);
      set((s) => ({ runs: { ...s.runs, [id]: r } }));
    } catch {
      // keep what is shown
    }
  },

  save: async (a) => {
    set({ error: null });
    try {
      const saved = await getBridge().automations.save(a);
      await get().load();
      return saved;
    } catch (e) {
      set({ error: msg(e) });
      return null;
    }
  },

  setEnabled: async (id, on) => {
    // Show the switch move at once; the list reloads with the real state.
    set((s) => ({ list: s.list.map((x) => (x.id === id ? { ...x, enabled: on } : x)) }));
    try {
      await getBridge().automations.setEnabled(id, on);
    } catch (e) {
      set({ error: msg(e) });
    }
    await get().load();
  },

  remove: async (id) => {
    try {
      await getBridge().automations.delete(id);
    } catch (e) {
      set({ error: msg(e) });
    }
    await get().load();
  },

  runNow: async (id) => {
    set({ error: null });
    try {
      await getBridge().automations.runNow(id);
    } catch (e) {
      set({ error: msg(e) });
    }
    await get().load();
  },

  setBackground: async (run, login) => {
    try {
      const background = await getBridge().automations.setBackground(run, login);
      set({ background });
    } catch (e) {
      set({ error: msg(e) });
    }
  },

  clearError: () => set({ error: null }),
}));
