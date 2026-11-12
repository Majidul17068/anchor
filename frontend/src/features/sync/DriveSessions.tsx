import React, { useEffect } from 'react';
import { useSyncStore } from '../../store/sync';
import { useSessionStore } from '../../store/session';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { formatBytes, formatRelativeDate } from '../../lib/format';
import { CloudDownload, FolderOpen, RefreshCw } from 'lucide-react';

/**
 * Sessions other devices saved to the user's Drive (Anchor/YYYY/MM/DD/…)
 * that this device has not pulled. Pulling one makes it a local replica
 * the user can open and continue; the parent device merges what is added.
 */
export const DriveSessions: React.FC<{ onOpenSession?: (id: string) => void }> = ({ onOpenSession }) => {
  const status = useSyncStore((s) => s.status);
  const available = useSyncStore((s) => s.available);
  const pulling = useSyncStore((s) => s.pulling);
  const loadAvailable = useSyncStore((s) => s.loadAvailable);
  const pullSession = useSyncStore((s) => s.pullSession);
  const loadSessions = useSessionStore((s) => s.loadSessions);

  const connected = Boolean(status?.driveConnected);

  useEffect(() => {
    if (connected) loadAvailable();
  }, [connected, loadAvailable]);

  if (!connected) return null;

  const handlePull = async (id: string) => {
    const s = await pullSession(id);
    if (s) {
      await loadSessions();
      onOpenSession?.(s.id);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[var(--anchor-accent)]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
            Sessions on Drive from other devices ({available.length})
          </h3>
        </div>
        <Button size="xs" variant="ghost" icon={<RefreshCw className="w-3 h-3" />} onClick={loadAvailable}>
          Refresh
        </Button>
      </div>

      {available.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-[var(--anchor-border)] text-xs text-[var(--anchor-text-subtle)] text-center">
          Nothing to pull. Switch <span className="font-medium text-[var(--anchor-text)]">Sync</span> on for a session on another device and it appears here, filed under <span className="font-mono">Anchor/YYYY/MM/DD</span> in your Drive.
        </div>
      ) : (
        <div className="space-y-2">
          {available.map((r) => (
            <div
              key={r.id}
              className="p-3 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-xl flex items-center justify-between gap-4 text-xs shadow-xs"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm text-[var(--anchor-text)] truncate">{r.title || 'Untitled session'}</span>
                  <Badge variant="info" size="xs">{r.originDeviceName || r.originDeviceId.slice(0, 8)}</Badge>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[var(--anchor-text-subtle)] font-mono">
                  <span>Anchor/{r.day}</span>
                  <span>{r.stepCount} steps</span>
                  <span>{formatBytes(r.sizeBytes)}</span>
                  <span>{formatRelativeDate(r.updatedAt)}</span>
                </div>
              </div>
              <Button
                size="xs"
                variant="primary"
                loading={pulling === r.id}
                disabled={pulling !== null && pulling !== r.id}
                icon={<CloudDownload className="w-3.5 h-3.5" />}
                onClick={() => handlePull(r.id)}
              >
                Pull to this device
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
