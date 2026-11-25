import React, { useEffect } from 'react';
import { useUsageStore } from '../../store/usage';
import { UsagePanel } from '../usage/UsagePanel';
import { Gauge } from 'lucide-react';

/** Settings: every limit on the account, with refill times. */
export const UsageSection: React.FC = () => {
  const load = useUsageStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--anchor-border-subtle)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-accent)]">
          <Gauge className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--anchor-text)]">Usage & Limits</h3>
          <p className="text-xs text-[var(--anchor-text-muted)]">
            How much of your weekly and five-hour allowance is left for each model group, and when it refills.
          </p>
        </div>
      </div>
      <UsagePanel />
    </div>
  );
};
