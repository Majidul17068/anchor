import React, { useEffect, useRef, useState } from 'react';
import { useUsageStore, levelColor, percent, tightestBucket, windowLabel } from '../../store/usage';
import { UsagePanel } from './UsagePanel';
import { Gauge } from 'lucide-react';

/**
 * Title-bar meter: shows the limit closest to running out at a glance and
 * opens the full list on click.
 */
export const UsageMeter: React.FC = () => {
  const usage = useUsageStore((s) => s.usage);
  const load = useUsageStore((s) => s.load);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    load();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, load]);

  const tight = tightestBucket(usage);
  const color = tight ? levelColor(tight.bucket.remainingFraction) : 'var(--anchor-text-subtle)';

  return (
    <div ref={ref} className="relative" style={{ ['--wails-draggable' as string]: 'no-drag' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Usage limits"
        aria-expanded={open}
        title={tight ? `${tight.group}: ${windowLabel(tight.bucket)}, ${percent(tight.bucket.remainingFraction)} left` : 'Usage limits'}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[var(--anchor-border)] bg-[var(--anchor-surface)] hover:bg-[var(--anchor-surface-elevated)] text-[var(--anchor-text-muted)] hover:text-[var(--anchor-text)] cursor-pointer"
      >
        <Gauge className="w-3.5 h-3.5" style={{ color }} />
        {tight ? (
          <>
            <span className="w-10 h-1.5 rounded-full bg-[var(--anchor-surface-sunken)] overflow-hidden hidden sm:block">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(4, tight.bucket.remainingFraction * 100)}%`, backgroundColor: color }} />
            </span>
            <span className="font-mono text-[11px]">{percent(tight.bucket.remainingFraction)}</span>
          </>
        ) : (
          <span className="text-[11px]">Usage</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 p-4 rounded-xl border border-[var(--anchor-border)] bg-[var(--anchor-surface-elevated)] shadow-lg z-50 text-left">
          <UsagePanel compact />
        </div>
      )}
    </div>
  );
};
