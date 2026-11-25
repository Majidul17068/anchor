/** "in 14 minutes", "in 3 hours", "tomorrow at 09:00", "Mon 30 Nov at 08:00". */
export function formatRelativeFuture(iso?: string, now = Date.now()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const ms = d.getTime() - now;
  if (!Number.isFinite(ms)) return '';
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'in less than a minute';
  if (mins < 60) return `in ${mins} minute${mins === 1 ? '' : 's'}`;
  const today = new Date(now);
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `today at ${hm}`;
  const tomorrow = new Date(now + 86_400_000);
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow at ${hm}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} at ${hm}`;
}

/** "42s", "3m 05s", "1h 12m". */
export function formatRunLength(startedAt?: string, finishedAt?: string): string {
  if (!startedAt || !finishedAt) return '';
  const s = Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
