import React, { useState } from 'react';
import type { SyncStatus } from '../../bridge/types';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { formatBytes, formatRelativeDate } from '../../lib/format';
import { PlanLock, useFeature } from '../../components/PlanGate';
import { useSyncStore } from '../../store/sync';
import { DriveHelp, folderKindLabel } from './DriveHelp';
import { Cloud, CloudOff, RefreshCw, ShieldCheck, UserRoundCog } from 'lucide-react';
import { confirmDialog } from '../../store/confirm';

export interface DriveStatusProps {
  status: SyncStatus | null;
  isSyncing: boolean;
  onSyncNow: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const DriveStatus: React.FC<DriveStatusProps> = ({
  status,
  isSyncing,
  onSyncNow,
  onConnect,
  onDisconnect,
}) => {
  const isConnected = Boolean(status?.driveConnected);
  const { gate: gateSync } = useFeature('drive_sync');
  const error = useSyncStore((s) => s.error);
  const changeAccount = useSyncStore((s) => s.changeAccount);
  const canChoose = useSyncStore((s) => s.canChooseAccount);
  const [changing, setChanging] = useState(false);

  // Google's account chooser opens in the browser; the current connection
  // stays as it is until a new account has been chosen there.
  const runChange = async () => {
    setChanging(true);
    await changeAccount(true);
    setChanging(false);
  };

  const handleChange = async () => {
    const ok = await confirmDialog({
      title: 'Use a different Google account?',
      message:
        `Your browser opens so you can choose the account. ` +
        `Sessions with Sync on are then saved to that account's Drive, and what Anchor learned moves with them. ` +
        `Copies you pulled from other devices stay on this computer. ` +
        `Nothing is deleted from ${status?.driveEmail || 'the current Drive'}; cancel in the browser and nothing changes.`,
      confirmLabel: 'Choose account',
    });
    if (ok) await runChange();
  };

  const handleDisconnect = async () => {
    const ok = await confirmDialog({
      title: 'Disconnect Google Drive?',
      message:
        `Anchor signs out of ${status?.driveEmail || 'this Drive'} and gives up its access to it. ` +
        `Your sessions stay on this computer, and the files already in the Drive stay there. ` +
        `You can connect the same account or another one afterwards.`,
      confirmLabel: 'Disconnect',
      danger: true,
    });
    if (ok) onDisconnect();
  };
  // A folder was chosen earlier but Drive for Desktop is not serving it now.
  const unhealthy = status?.folderPath && status.health && status.health !== 'ok' ? `${status.health}: ${status.healthMessage ?? ''}` : null;

  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isConnected
                ? 'bg-[var(--anchor-ok-subtle)] text-[var(--anchor-ok)] border-[var(--anchor-ok)]/20'
                : 'bg-[var(--anchor-surface-sunken)] text-[var(--anchor-text-subtle)] border-[var(--anchor-border)]'
            }`}
          >
            {isConnected ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[var(--anchor-text)]">
                Google Drive
              </h3>
              <span title={status?.folderPath}>
                <Badge variant={isConnected ? 'ok' : 'default'} size="xs">
                  {isConnected ? (status?.backend === 'folder' ? folderKindLabel(status.folderKind) : 'Connected') : 'Disconnected'}
                </Badge>
              </span>
            </div>
            <p className="text-xs text-[var(--anchor-text-muted)]">
              {isConnected
                ? status?.backend === 'folder'
                  ? `Sessions are saved to the Anchor folder in your ${folderKindLabel(status.folderKind)}${status.driveEmail ? ` (${status.driveEmail})` : ''}; its desktop client keeps it in sync.`
                  : `Synchronizing sessions & skills directly with ${status?.driveEmail || 'your Google account'}`
                : 'Connect your Google Drive: an Anchor folder is created in it and your sessions are saved there, filed by day.'}
            </p>
            {status?.lastSyncAt && (
              <p className="text-[11px] text-[var(--anchor-text-subtle)]">
                Last synchronized {formatRelativeDate(status.lastSyncAt)}
                {' · '}
                {new Date(status.lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Button
                variant="primary"
                size="sm"
                loading={isSyncing}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={onSyncNow}
              >
                Sync Now
              </Button>
              {canChoose && (
                <Button variant="outline" size="sm" loading={changing} icon={<UserRoundCog className="w-3.5 h-3.5" />} onClick={handleChange}>
                  Change account
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <PlanLock feature="drive_sync" />
              <Button
                variant="primary"
                size="sm"
                loading={isSyncing && !changing}
                icon={<Cloud className="w-3.5 h-3.5" />}
                onClick={gateSync(onConnect)}
              >
                Connect Google Drive
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Which account, and how to pick another */}
      {isConnected ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-xs">
          <span className="text-[var(--anchor-text-subtle)]">Account</span>
          <span className="font-mono font-medium text-[var(--anchor-text)] selectable">{status?.driveEmail || 'unknown'}</span>
          <span className="text-[var(--anchor-text-subtle)]">
            · {status?.backend === 'folder' ? `through ${folderKindLabel(status.folderKind)} on this computer` : 'signed in through the browser'}
          </span>
        </div>
      ) : (
        canChoose && (
          <p className="text-[11px] text-[var(--anchor-text-subtle)]">
            Connect picks Google Drive for Desktop when it is running on this computer.{' '}
            <button
              onClick={gateSync(() => void runChange())}
              disabled={changing}
              className="text-[var(--anchor-accent)] hover:underline cursor-pointer disabled:opacity-50"
            >
              {changing ? 'Waiting for the browser…' : 'Sign in with a Google account of your choice instead'}
            </button>
            .
          </p>
        )
      )}

      {error ? <DriveHelp error={error} onRetry={onConnect} /> : unhealthy ? <DriveHelp error={unhealthy} onRetry={onConnect} /> : null}

      {isConnected && status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--anchor-border-subtle)] text-xs">
          <div>
            <span className="text-[11px] text-[var(--anchor-text-subtle)] block">
              Drive App-Folder Usage
            </span>
            <span className="font-mono font-medium text-[var(--anchor-text)]">
              {formatBytes(status.usageBytes)}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-[var(--anchor-text-subtle)] block">
              Last Synced
            </span>
            <span className="font-mono text-[var(--anchor-text-muted)]">
              {status.lastSyncAt ? formatRelativeDate(status.lastSyncAt) : 'Never'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-[var(--anchor-text-subtle)] block">
              Pending Changes
            </span>
            <span className="font-mono text-[var(--anchor-text-muted)]">
              {status.pending} items
            </span>
          </div>

          <div>
            <span className="text-[11px] text-[var(--anchor-text-subtle)] block">
              Active Conflicts
            </span>
            <span
              className={`font-mono font-semibold ${
                status.conflicts > 0 ? 'text-[var(--anchor-danger)]' : 'text-[var(--anchor-ok)]'
              }`}
            >
              {status.conflicts} conflicts
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
