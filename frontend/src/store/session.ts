import { create } from 'zustand';
import type { Effort, Mode, Session } from '../bridge/types';
import { getBridge } from '../bridge';

interface SessionState {
  sessions: Session[];
  currentSessionId: string | null;
  activeSession: Session | null;
  searchQuery: string;
  loading: boolean;
  errorMessage: string | null;

  setSearchQuery: (query: string) => void;
  clearError: () => void;
  loadSessions: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  createSession: (input?: {
    title?: string;
    agentId?: string;
    modelId?: string;
    effort?: Effort;
    mode?: Mode;
    workspacePaths?: string[];
  }) => Promise<Session>;
  updateSession: (
    id: string,
    patch: Partial<Pick<Session, 'title' | 'pinned' | 'modelId' | 'effort' | 'mode' | 'agentId'>>
  ) => Promise<void>;
  toggleSync: (id: string) => Promise<boolean>;
  deleteSession: (id: string) => Promise<void>;
  exportMarkdown: (id: string) => Promise<string>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  activeSession: null,
  searchQuery: '',
  loading: false,
  errorMessage: null,

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  clearError: () => set({ errorMessage: null }),

  loadSessions: async () => {
    try {
      set({ loading: true });
      const bridge = getBridge();
      const list = await bridge.sessions.list();
      set({ sessions: list, loading: false });

      // Check for saved session or default to first
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('anchor.lastSession') : null;
      const target = (savedId && list.find((s) => s.id === savedId)) || list[0];
      if (target && !get().currentSessionId) {
        await get().selectSession(target.id);
      }
    } catch (err: any) {
      set({ errorMessage: err.message || 'Failed to load sessions', loading: false });
    }
  },

  selectSession: async (id: string) => {
    try {
      set({ currentSessionId: id });
      if (typeof window !== 'undefined') {
        localStorage.setItem('anchor.lastSession', id);
      }
      const bridge = getBridge();
      const { session } = await bridge.sessions.get(id);
      set({ activeSession: session });
      if (typeof document !== 'undefined') {
        document.title = `Anchor — ${session.title}`;
      }
    } catch (err: any) {
      set({ errorMessage: err.message || 'Failed to fetch session' });
    }
  },

  createSession: async (input) => {
    const bridge = getBridge();
    const last = get().activeSession;
    const newSession = await bridge.sessions.create({
      title: input?.title || 'New Session',
      agentId: input?.agentId ?? '',
      modelId: input?.modelId || last?.modelId || 'gemini-4-argon',
      effort: input?.effort || last?.effort || 'medium',
      mode: input?.mode || last?.mode || 'default',
      // Empty means "the backend picks a sensible folder" (home directory).
      workspacePaths: input?.workspacePaths || last?.workspacePaths || [],
    });

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSessionId: newSession.id,
      activeSession: newSession,
    }));

    if (typeof window !== 'undefined') {
      localStorage.setItem('anchor.lastSession', newSession.id);
      document.title = `Anchor — ${newSession.title}`;
    }

    return newSession;
  },

  updateSession: async (id, patch) => {
    const bridge = getBridge();
    const updated = await bridge.sessions.update(id, patch);
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
      activeSession: state.activeSession?.id === id ? updated : state.activeSession,
    }));
    if (patch.title && typeof document !== 'undefined') {
      document.title = `Anchor — ${patch.title}`;
    }
  },

  toggleSync: async (id: string) => {
    const sess = get().sessions.find((s) => s.id === id);
    if (!sess) return false;

    try {
      const bridge = getBridge();
      const updated = await bridge.sessions.setSync(id, !sess.syncEnabled);
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
        activeSession: state.activeSession?.id === id ? updated : state.activeSession,
      }));
      return true;
    } catch (err: any) {
      if (err.message === 'NOT_PARENT_SOURCE') {
        set({ errorMessage: 'Only the parent source controls sync for this session.' });
      } else {
        set({ errorMessage: err.message || 'Failed to toggle sync' });
      }
      return false;
    }
  },

  deleteSession: async (id: string) => {
    const bridge = getBridge();
    await bridge.sessions.delete(id);
    const remaining = get().sessions.filter((s) => s.id !== id);
    const nextSession = remaining[0] || null;
    set({
      sessions: remaining,
      currentSessionId: nextSession ? nextSession.id : null,
      activeSession: nextSession,
    });
    if (nextSession) {
      await get().selectSession(nextSession.id);
    }
  },

  exportMarkdown: async (id: string) => {
    const bridge = getBridge();
    return bridge.sessions.exportMarkdown(id);
  },
}));
