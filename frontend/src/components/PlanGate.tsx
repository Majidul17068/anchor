import React from 'react';
import { create } from 'zustand';
import { useAuthStore } from '../store/auth';
import { getBridge } from '../bridge';
import { FEATURES, canUse, planLabel, upgradeUrl, type Feature } from '../lib/plan';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Badge } from './Badge';
import { Lock, Sparkles } from 'lucide-react';

interface PlanPromptState {
  feature: Feature | null;
  open: (f: Feature) => void;
  close: () => void;
}

const usePlanPrompt = create<PlanPromptState>((set) => ({
  feature: null,
  open: (feature) => set({ feature }),
  close: () => set({ feature: null }),
}));

/**
 * `allowed` says whether the signed-in plan covers the feature; `gate(fn)`
 * wraps a handler so a click on a locked feature explains the upgrade
 * instead of silently doing nothing.
 */
export function useFeature(feature: Feature) {
  const plan = useAuthStore((s) => s.account?.plan);
  const allowed = canUse(plan, feature);
  const open = usePlanPrompt((s) => s.open);
  const gate = <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      if (allowed) fn(...args);
      else open(feature);
    };
  return { allowed, gate, explain: () => open(feature) };
}

/** Small lock badge for buttons that lead to a gated feature. */
export const PlanLock: React.FC<{ feature: Feature }> = ({ feature }) => {
  const { allowed } = useFeature(feature);
  if (allowed) return null;
  return (
    <Badge variant="outline" size="xs" className="gap-1">
      <Lock className="w-2.5 h-2.5" /> {planLabel(FEATURES[feature].min)}
    </Badge>
  );
};

/** Renders children when allowed, otherwise an inline upgrade card. */
export const PlanGate: React.FC<{ feature: Feature; children: React.ReactNode }> = ({ feature, children }) => {
  const { allowed } = useFeature(feature);
  if (allowed) return <>{children}</>;
  return <UpgradeCard feature={feature} />;
};

const UpgradeCard: React.FC<{ feature: Feature }> = ({ feature }) => {
  const account = useAuthStore((s) => s.account);
  const f = FEATURES[feature];
  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-dashed border-[var(--anchor-border)] rounded-2xl text-left space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-[var(--anchor-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--anchor-text)]">{f.label} needs {planLabel(f.min)}</h3>
      </div>
      <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">{f.blurb}</p>
      <p className="text-xs text-[var(--anchor-text-subtle)]">
        Signed in as <span className="font-mono">{account?.email}</span> on{' '}
        <span className="font-medium text-[var(--anchor-text)]">{planLabel(account?.plan, account?.planName)}</span>.
      </p>
      <Button
        size="sm"
        variant="primary"
        icon={<Sparkles className="w-3.5 h-3.5" />}
        onClick={() => getBridge().system.openExternal(upgradeUrl(account))}
      >
        See Google AI plans
      </Button>
    </div>
  );
};

/** Hosts the dialog `useFeature().gate()` opens. Mount once. */
export const PlanHost: React.FC = () => {
  const feature = usePlanPrompt((s) => s.feature);
  const close = usePlanPrompt((s) => s.close);
  const account = useAuthStore((s) => s.account);
  if (!feature) return null;
  const f = FEATURES[feature];
  return (
    <Dialog
      open
      onClose={close}
      title={`${f.label} needs ${planLabel(f.min)}`}
      description={f.blurb}
      maxWidth="sm"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={close}>
            Not now
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => {
              getBridge().system.openExternal(upgradeUrl(account));
              close();
            }}
          >
            See Google AI plans
          </Button>
        </div>
      }
    >
      <p className="text-xs text-[var(--anchor-text-subtle)]">
        You are signed in as <span className="font-mono">{account?.email}</span> on{' '}
        <span className="font-medium text-[var(--anchor-text)]">{planLabel(account?.plan, account?.planName)}</span>.
        Upgrade with that account, then sign out and back in so Anchor picks up the new tier.
      </p>
    </Dialog>
  );
};
