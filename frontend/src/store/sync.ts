import { create } from 'zustand';
import type { Conflict, Device, RemoteSession, Session, SyncFolderCandidate, SyncStatus } from '../bridge/types';
import { getBridge } from '../bridge';

interface SyncState {
  status: SyncStatus | null;
  devices: Device[];
  conflicts: Conflict[];
  thisDevice: Device | null;
  isSyncing: boolean;
  loading: boolean;
  /** Why the last connect/sync failed, for the UI to show. */
  error: string | null;
  /** Sessions on Drive from other devices, not yet pulled here. */
  available: RemoteSession[];
  /** Id of the session being pulled right now. */
  pulling: string | null;

  /** Synced folders detected on this machine, loaded on demand. */
  candidates: SyncFolderCandidate[];

  loadSyncState: () => Promise<void>;
  chooseFolder: () => Promise<void>;
  loadCandidates: () => Promise<void>;
  useFolder: (path: string) => Promise<void>;
  loadAvailable: () => Promise<void>;
  pullSession: (sessionId: string) => Promise<Session | null>;
  syncNow: () => Promise<void>;
  connectDrive: () => Promise<void>;
  disconnectDrive: () => Promise<void>;
  resolveConflict: (sessionId: string, as: 'parent' | 'merged') => Promise<void>;
  renameDevice: (name: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: null,
  devices: [],
  conflicts: [],
  thisDevice: null,
  isSyncing: false,
  loading: false,
  error: null,
  available: [],
  pulling: null,
  candidates: [],

  loadSyncState: async () => {
    try {
      set({ loading: true });
      const bridge = getBridge();
      const [st, devs, thisDev, confl] = await Promise.all([
        bridge.sync.status(),
        bridge.devices.list(),
        bridge.devices.thisDevice(),
        bridge.sync.conflicts(),
      ]);
      set({
        status: st,
        devices: devs,
        thisDevice: thisDev,
        conflicts: confl,
        loading: false,
      });

      // subscribe to live sync changes
      bridge.sync.onChange((newStatus) => {
        set({ status: newStatus });
      });
    } catch {
      set({ loading: false });
    }
  },

  syncNow: async () => {
    set({ isSyncing: true, error: null });
    try {
      const bridge = getBridge();
      const updated = await bridge.sync.syncNow();
      set({ status: updated, isSyncing: false });
    } catch (e) {
      set({ isSyncing: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  connectDrive: async () => {
    set({ isSyncing: true, error: null });
    try {
      const bridge = getBridge();
      const st = await bridge.sync.connectDrive();
      set({ status: st, isSyncing: false });
    } catch (e) {
      // A build without a Google OAuth client, or a cancelled consent
      // screen, must say so rather than leave the button looking dead.
      set({ isSyncing: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  loadCandidates: async () => {
    try {
      const bridge = getBridge();
      set({ candidates: await bridge.sync.folderCandidates() });
    } catch {
      set({ candidates: [] });
    }
  },

  useFolder: async (path: string) => {
    set({ isSyncing: true, error: null });
    try {
      const bridge = getBridge();
      const st = await bridge.sync.useFolder(path);
      set({ status: st, isSyncing: false });
    } catch (e) {
      set({ isSyncing: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  chooseFolder: async () => {
    set({ isSyncing: true, error: null });
    try {
      const bridge = getBridge();
      const st = await bridge.sync.chooseFolder();
      set({ status: st, isSyncing: false });
    } catch (e) {
      set({ isSyncing: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  disconnectDrive: async () => {
    const bridge = getBridge();
    await bridge.sync.disconnectDrive();
    await get().loadSyncState();
  },

  resolveConflict: async (sessionId, as) => {
    const bridge = getBridge();
    await bridge.sync.resolveConflict(sessionId, as);
    await get().loadSyncState();
  },

  renameDevice: async (name: string) => {
    const bridge = getBridge();
    await bridge.devices.rename(name);
    await get().loadSyncState();
  },

  loadAvailable: async () => {
    try {
      const bridge = getBridge();
      const list = await bridge.sync.available();
      set({ available: list });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  pullSession: async (sessionId: string) => {
    set({ pulling: sessionId, error: null });
    try {
      const bridge = getBridge();
      const s = await bridge.sync.pull(sessionId);
      set((state) => ({ available: state.available.filter((r) => r.id !== sessionId), pulling: null }));
      return s;
    } catch (e) {
      set({ pulling: null, error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },
}));
