import type { Account, Plan } from '../bridge/types';

/**
 * What each Google AI subscription unlocks in Anchor.
 *
 * The plan comes from the Antigravity CLI's own tier report at sign-in. The
 * CLI already enforces model and quota limits on its side; these gates only
 * decide which Anchor features are offered, and they live in one place so
 * the split can be changed without hunting through pages.
 */

export type Feature = 'agents' | 'market_publish' | 'drive_sync' | 'skill_train';

export const FEATURES: Record<Feature, { label: string; min: Plan; blurb: string }> = {
  agents: {
    label: 'Custom agents',
    min: 'google_ai_pro',
    blurb: 'Create, edit and test your own agent personas with their own model, effort, tools and skills.',
  },
  market_publish: {
    label: 'Marketplace publishing',
    min: 'google_ai_pro',
    blurb: 'Publish skills to the Anchor Marketplace and answer skill requests.',
  },
  drive_sync: {
    label: 'Google Drive sync',
    min: 'google_ai_pro',
    blurb: 'Sync sessions and skills across your devices through your Google Drive app folder.',
  },
  skill_train: {
    label: 'Skill training',
    min: 'google_ai_pro',
    blurb: 'Run evaluation examples against a skill and let the agent improve it.',
  },
};

const RANK: Record<Plan, number> = { free: 0, google_ai_pro: 1, google_ai_ultra: 2, unknown: -1 };

export const DEFAULT_UPGRADE_URL = 'https://one.google.com/about/google-ai-plans/';

/**
 * `unknown` means the tier probe has not succeeded yet (CLI not reachable,
 * first launch). Locking someone out over a failed probe is worse than
 * letting them through, so unknown is treated as allowed.
 */
export function canUse(plan: Plan | undefined, feature: Feature): boolean {
  const p = plan ?? 'unknown';
  if (p === 'unknown') return true;
  return RANK[p] >= RANK[FEATURES[feature].min];
}

export function planLabel(plan: Plan | undefined, planName?: string): string {
  if (planName) return planName;
  switch (plan) {
    case 'google_ai_pro':
      return 'Google AI Pro';
    case 'google_ai_ultra':
      return 'Google AI Ultra';
    case 'free':
      return 'Free';
    default:
      return 'Plan not detected';
  }
}

export function upgradeUrl(account: Account | null | undefined): string {
  return account?.upgradeUrl || DEFAULT_UPGRADE_URL;
}
