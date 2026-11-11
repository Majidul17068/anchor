import { create } from 'zustand';
import type { Account, Plan } from '../bridge/types';
import { getBridge } from '../bridge';

interface AuthState {
  account: Account | null;
  loading: boolean;
  plan: Plan;
  checkStatus: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  loading: true,
  plan: 'unknown',

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
      set({ loading: true });
      const bridge = getBridge();
      const account = await bridge.auth.login();
      set({ account, plan: account.plan, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  logout: async () => {
    try {
      const bridge = getBridge();
      await bridge.auth.logout();
      set({ account: null, plan: 'unknown' });
    } catch {
      // ignore
    }
  },
}));
