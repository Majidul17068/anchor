import { create } from 'zustand';
import type { Account, Plan } from '../bridge/types';
import { getBridge } from '../bridge';

interface AuthState {
  account: Account | null;
  loading: boolean;
  plan: Plan;
  /** Why the last sign-in or sign-out failed, for the UI to show. */
  error: string | null;
  checkStatus: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  loading: true,
  plan: 'unknown',
  error: null,

  checkStatus: async () => {
    try {
      set({ loading: true });
      const bridge = getBridge();
      const account = await bridge.auth.status();
      set({ account, plan: account?.plan || 'unknown', loading: false });
    } catch {
      set({ account: null, plan: 'unknown', loading: false });
    }
  },

  login: async () => {
    try {
      set({ loading: true, error: null });
      const bridge = getBridge();
      const account = await bridge.auth.login();
      set({ account, plan: account.plan, loading: false });
    } catch (e) {
      // Swallowing this is what made a failed sign-in look like a dead button.
      set({ loading: false, error: message(e) });
    }
  },

  logout: async () => {
    try {
      set({ error: null });
      const bridge = getBridge();
      await bridge.auth.logout();
      set({ account: null, plan: 'unknown' });
    } catch (e) {
      set({ error: message(e) });
    }
  },
}));
