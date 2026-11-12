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
            The device on which a session was originally created owns that session&apos;s lifecycle. Only this parent device can switch Sync on or off, which saves the session to, or removes it from, the Anchor folder in your Google Drive.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-[var(--anchor-info)] font-semibold">
            <Cloud className="w-4 h-4" />
            <span>2. Pull What You Need</span>
          </div>
          <p className="text-[var(--anchor-text-muted)] text-[11px] leading-relaxed">
            Any other device signed in to the same Google account sees the sessions saved under Anchor/year/month/day and pulls the ones it wants. A pulled session is a replica: open it and continue where you left off; it keeps refreshing from Drive.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-[var(--anchor-ok)] font-semibold">
            <GitMerge className="w-4 h-4" />
            <span>3. Appends Merged by the Parent</span>
          </div>
          <p className="text-[var(--anchor-text-muted)] text-[11px] leading-relaxed">
            Messages you add on a replica are saved next to the session as an append file. When the parent device syncs, it merges them into the canonical transcript; if both sides changed in the meantime, the parent is asked to choose.
          </p>
        </div>
      </div>
    </div>
  );
};
