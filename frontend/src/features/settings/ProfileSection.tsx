import React from 'react';
import { StepProfile } from '../onboarding/StepProfile';
import { ShieldCheck } from 'lucide-react';

/**
 * Name, device, and the standing instructions the agent always follows.
 * Same form as onboarding, so what was set there can be changed here.
 */
export const ProfileSection: React.FC<{ onShowToast?: (msg: string) => void }> = ({ onShowToast }) => (
  <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
    <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--anchor-border-subtle)]">
      <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-accent)]">
        <ShieldCheck className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--anchor-text)]">You and your agent rules</h3>
        <p className="text-xs text-[var(--anchor-text-muted)]">
          Your name, this device, and the instructions the Antigravity agent follows in every conversation, in Anchor and in the terminal.
        </p>
      </div>
    </div>
    <StepProfile onComplete={() => onShowToast?.('Saved. New conversations follow the updated instructions.')} />
  </div>
);
