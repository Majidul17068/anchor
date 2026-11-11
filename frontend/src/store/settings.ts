import { create } from 'zustand';
import { getBridge } from '../bridge';

export type ThemeMode = 'dark' | 'light';
export type Density = 'compact' | 'comfortable';
export type FontSize = 'small' | 'medium' | 'large';

interface SettingsState {
  settings: Record<string, any>;
  cliStatus: { installed: boolean; path?: string; version?: string; updateAvailable?: string } | null;
  installingCli: boolean;
  installProgress: { phase: string; percent: number; message: string } | null;
  theme: ThemeMode;
  density: Density;
  fontSize: FontSize;
  loading: boolean;

  loadSettings: () => Promise<void>;
  updateSettings: (patch: Record<string, any>) => Promise<void>;
  checkCli: () => Promise<void>;
  installCli: () => Promise<void>;
  locateCli: () => Promise<string | null>;
  setTheme: (theme: ThemeMode) => void;
  setDensity: (density: Density) => void;
  setFontSize: (fontSize: FontSize) => void;
  clearLocalCache: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  cliStatus: null,
  installingCli: false,
  installProgress: null,
  theme: 'dark',
  density: 'compact',
  fontSize: 'medium',
  loading: false,

  loadSettings: async () => {
    try {
      set({ loading: true });
      const bridge = getBridge();
      const [stored, cli] = await Promise.all([bridge.settings.get(), bridge.system.cliStatus()]);

      let savedTheme = (typeof window !== 'undefined' ? (localStorage.getItem('anchor.theme') as ThemeMode) : null) || 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }

      set({
        settings: stored,
        cliStatus: cli,
        theme: savedTheme,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  updateSettings: async (patch) => {
    const bridge = getBridge();
    await bridge.settings.set(patch);
    set((state) => ({ settings: { ...state.settings, ...patch } }));
  },

  checkCli: async () => {
    const bridge = getBridge();
    const cli = await bridge.system.cliStatus();
    set({ cliStatus: cli });
  },

  installCli: async () => {
    set({ installingCli: true, installProgress: { phase: 'download', percent: 0, message: 'Starting download...' } });
    try {
      const bridge = getBridge();
      const stream = bridge.system.installCli();
      for await (const p of stream) {
        set({ installProgress: p });
      }
      await get().checkCli();
    } finally {
      set({ installingCli: false, installProgress: null });
    }
  },

  locateCli: async () => {
    const bridge = getBridge();
    const path = await bridge.system.locateCli();
    if (path) {
      await get().checkCli();
    }
    return path;
  },

  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== 'undefined') {
      localStorage.setItem('anchor.theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  },

  setDensity: (density) => set({ density }),
  setFontSize: (fontSize) => set({ fontSize }),

  clearLocalCache: async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('anchor.lastSession');
      localStorage.removeItem('anchor.rail');
    }
    const bridge = getBridge();
    await bridge.settings.set({ cacheClearedAt: new Date().toISOString() });
    await get().loadSettings();
  },
}));
