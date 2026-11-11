import React from 'react';
import { ArrowDownRight, Cloud, GitMerge, Info, Laptop, ShieldCheck } from 'lucide-react';

export const RulesPanel: React.FC = () => {
  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-[var(--anchor-accent)] shrink-0" />
        <h3 className="text-sm font-semibold text-[var(--anchor-text)]">
          Anchor Synchronization Architecture: Parent-Source Model
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-3.5 rounded-xl bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-[var(--anchor-warn)] font-semibold">
            <Laptop className="w-4 h-4" />
            <span>1. Parent Source Authority</span>
          </div>
          <p className="text-[var(--anchor-text-muted)] text-[11px] leading-relaxed">
            The device on which a session was originally created owns that session&apos;s lifecycle. Only this parent device can enable sync, disable sync, or delete the session from your Google Drive database.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-[var(--anchor-info)] font-semibold">
            <Cloud className="w-4 h-4" />
            <span>2. Automatic Replica Pull</span>
          </div>
          <p className="text-[var(--anchor-text-muted)] text-[11px] leading-relaxed">
            All other devices authenticated with your Google AI account act as replicas. They automatically download published sessions and skill updates whenever you switch devices.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-[var(--anchor-ok)] font-semibold">
            <GitMerge className="w-4 h-4" />
            <span>3. Signed Mutation Deltas</span>
          </div>
          <p className="text-[var(--anchor-text-muted)] text-[11px] leading-relaxed">
            When you run Antigravity prompts on a replica device, Anchor writes a cryptographic delta chunk. When the parent source comes online, it merges the append log without overwriting local history.
          </p>
        </div>
      </div>
    </div>
  );
};
