import { create } from 'zustand';
import type { Usage, UsageBucket } from '../bridge/types';
import { getBridge } from '../bridge';

interface UsageState {
  usage: Usage | null;
  loading: boolean;
  error: string | null;
  /** When the last forced refresh was asked for, to avoid hammering the CLI. */
  lastForcedAt: number;
  load: (force?: boolean) => Promise<void>;
  clear: () => void;
}

export const useUsageStore = create<UsageState>((set, get) => ({
  usage: null,
  loading: false,
  error: null,
  lastForcedAt: 0,

  load: async (force = false) => {
    if (get().loading) return;
    // A forced read starts the CLI; once every 20 s is plenty.
    if (force && Date.now() - get().lastForcedAt < 20_000) force = false;
    set({ loading: true, ...(force ? { lastForcedAt: Date.now() } : {}) });
    try {
      const usage = await getBridge().usage.get(force);
      set({ usage, loading: false, error: null });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  clear: () => set({ usage: null, error: null }),
}));

/** The bucket closest to running out, across every group. */
export function tightestBucket(usage: Usage | null): { bucket: UsageBucket; group: string } | null {
  if (!usage) return null;
  let best: { bucket: UsageBucket; group: string } | null = null;
  for (const g of usage.groups) {
    for (const b of g.buckets) {
      if (!best || b.remainingFraction < best.bucket.remainingFraction) best = { bucket: b, group: g.name };
    }
  }
  return best;
}

/** "resets in 2h 14m", "resets in 5d 3h", or "" when unknown or past. */
export function resetsIn(resetTime?: string, now = Date.now()): string {
  if (!resetTime) return '';
  const ms = new Date(resetTime).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const mins = Math.floor(ms / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `resets in ${d}d ${h}h`;
  if (h > 0) return `resets in ${h}h ${m}m`;
  return `resets in ${Math.max(1, m)}m`;
}

/** Short window label for a bucket. */
export function windowLabel(b: UsageBucket): string {
  if (b.window === 'weekly') return 'Weekly limit';
  if (b.window === '5h') return '5-hour limit';
  return b.name.replace(/\s*remaining$/i, '');
}

/** Colour token for how much is left. */
export function levelColor(fraction: number): string {
  if (fraction <= 0.1) return 'var(--anchor-danger)';
  if (fraction <= 0.3) return 'var(--anchor-warn)';
  return 'var(--anchor-ok)';
}

/** 0.9349 -> "93%"; anything above zero never shows as 0%. */
export function percent(fraction: number): string {
  const p = Math.round(fraction * 100);
  if (p === 0 && fraction > 0) return '<1%';
  return `${p}%`;
}
