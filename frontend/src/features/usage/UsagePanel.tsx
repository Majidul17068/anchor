import React, { useEffect, useState } from 'react';
import { useUsageStore, levelColor, percent, resetsIn, windowLabel } from '../../store/usage';
import { formatRelativeDate } from '../../lib/format';
import { RefreshCw } from 'lucide-react';

export interface UsagePanelProps {
  /** Compact spacing for the title-bar popover. */
  compact?: boolean;
}

/**
 * Every limit on the account, as the Antigravity CLI reports it: for each
 * model group the weekly and five-hour allowance still available and when
 * it refills, plus remaining AI credits.
 */
export const UsagePanel: React.FC<UsagePanelProps> = ({ compact }) => {
  const usage = useUsageStore((s) => s.usage);
  const loading = useUsageStore((s) => s.loading);
  const error = useUsageStore((s) => s.error);
  const load = useUsageStore((s) => s.load);
  // Re-render every half minute so the countdowns move.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const signedOut = error?.startsWith('AUTH_REQUIRED');

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-[var(--anchor-text)] block">
            Usage limits{usage?.tier ? ` · ${usage.tier}` : ''}
          </span>
          <span className="text-[10px] text-[var(--anchor-text-subtle)] block">
            {usage ? `Updated ${formatRelativeDate(usage.fetchedAt).toLowerCase()}` : loading ? 'Reading from the Antigravity CLI…' : 'Not loaded yet'}
          </span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          aria-label="Refresh usage"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] text-[11px] text-[var(--anchor-text-muted)] hover:text-[var(--anchor-text)] hover:bg-[var(--anchor-surface-hover)] disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && !usage && (
        <div className="p-2.5 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-[11px] text-[var(--anchor-text-muted)]">
          {signedOut ? 'Sign in with Google to see your limits.' : `Could not read your limits: ${error}`}
        </div>
      )}

      {usage?.groups.map((g) => (
        <div key={g.name} className="space-y-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)] block">{g.name}</span>
            {g.description && !compact && (
              <span className="text-[11px] text-[var(--anchor-text-subtle)] block leading-snug">{g.description.replace(/^Models within this group:\s*/i, '')}</span>
            )}
          </div>
          {g.buckets.map((b) => {
            const color = levelColor(b.remainingFraction);
            const reset = resetsIn(b.resetTime, now);
            return (
              <div key={b.id} title={b.description || undefined}>
                <div className="flex items-baseline justify-between gap-2 text-[11px] mb-1">
                  <span className="text-[var(--anchor-text-muted)]">{windowLabel(b)}</span>
                  <span className="font-mono text-[var(--anchor-text-subtle)]">
                    <strong style={{ color }} className="font-semibold">{percent(b.remainingFraction)} left</strong>
                    {reset ? ` · ${reset}` : ''}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(b.remainingFraction * 100)}
                  aria-label={`${g.name}: ${windowLabel(b)}`}
                  className="h-1.5 w-full rounded-full bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border-subtle)] overflow-hidden"
                >
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, b.remainingFraction * 100)}%`, backgroundColor: color }} />
                </div>
                {b.resetTime && !compact && (
                  <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono block mt-0.5">
                    Refills {new Date(b.resetTime).toLocaleString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {usage?.credits && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--anchor-border-subtle)] text-[11px]">
          <span className="text-[var(--anchor-text-muted)]">AI credits remaining</span>
          <span className="font-mono font-semibold text-[var(--anchor-text)]">{usage.credits.remaining.toLocaleString()}</span>
        </div>
      )}

      {usage?.description && !compact && (
        <p className="text-[11px] text-[var(--anchor-text-subtle)] leading-relaxed">{usage.description}</p>
      )}
    </div>
  );
};
