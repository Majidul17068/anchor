import { create } from 'zustand';
import type { LearnStatus, Suggestion, SuggestionEdit } from '../bridge/types';
import { getBridge } from '../bridge';

interface LearnState {
  status: LearnStatus | null;
  suggestions: Suggestion[];
  /** Result line of the last manual run, for the UI. */
  lastResult: string | null;
  error: string | null;
  load: () => Promise<void>;
  setStatus: (s: LearnStatus) => void;
  run: () => Promise<void>;
  accept: (id: string, edit?: SuggestionEdit) => Promise<Suggestion | null>;
  reject: (id: string) => Promise<void>;
  forget: () => Promise<void>;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useLearnStore = create<LearnState>((set, get) => ({
  status: null,
  suggestions: [],
  lastResult: null,
  error: null,

  load: async () => {
    try {
      const bridge = getBridge();
      const [status, suggestions] = await Promise.all([bridge.learn.status(), bridge.learn.list()]);
      set({ status, suggestions });
    } catch (e) {
      set({ error: message(e) });
    }
  },

  // The desktop shell reports progress (a run started, finished, a draft was decided).
  setStatus: (status) => {
    const wasRunning = get().status?.running;
    set({ status });
    if (wasRunning && !status.running) void get().load();
  },

  run: async () => {
    set({ error: null, lastResult: null, status: get().status ? { ...get().status!, running: true } : null });
    try {
      const n = await getBridge().learn.run();
      set({ lastResult: n === 0 ? 'Nothing new stood out. That is normal: suggestions appear only when something clearly repeats.' : `${n} new suggestion${n > 1 ? 's' : ''} to review.` });
    } catch (e) {
      set({ error: message(e) });
    }
    await get().load();
  },

  accept: async (id, edit) => {
    set({ error: null });
    try {
      const done = await getBridge().learn.accept(id, edit);
      await get().load();
      return done;
    } catch (e) {
      set({ error: message(e) });
      return null;
    }
  },

  reject: async (id) => {
    try {
      await getBridge().learn.reject(id);
    } catch (e) {
      set({ error: message(e) });
    }
    await get().load();
  },

  forget: async () => {
    await getBridge().learn.forget();
    set({ lastResult: null });
    await get().load();
  },
}));
