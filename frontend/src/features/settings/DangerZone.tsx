import React from 'react';
import { useSettingsStore } from '../../store/settings';
import { useSyncStore } from '../../store/sync';
import { confirmDialog } from '../../store/confirm';
import { Button } from '../../components/Button';
import { AlertTriangle, CloudOff, Trash2 } from 'lucide-react';

export interface DangerZoneProps {
  onShowToast: (msg: string) => void;
}

export const DangerZone: React.FC<DangerZoneProps> = ({ onShowToast }) => {
  const clearLocalCache = useSettingsStore((s) => s.clearLocalCache);
  const disconnectDrive = useSyncStore((s) => s.disconnectDrive);
  const syncStatus = useSyncStore((s) => s.status);

  const handleClearCache = async () => {
    const ok = await confirmDialog({
      title: 'Clear local cache?',
      message: 'Clears local caches and session selection state. Google Drive data is not touched.',
      confirmLabel: 'Clear cache',
      danger: true,
    });
    if (ok) {
      await clearLocalCache();
      onShowToast('Local client cache cleared');
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirmDialog({
      title: 'Disconnect Google Drive?',
      message: 'Local sessions stay on this machine; they just stop syncing.',
      confirmLabel: 'Disconnect',
      danger: true,
    });
    if (ok) {
      await disconnectDrive();
      onShowToast('Google Drive disconnected');
    }
  };

  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-danger)]/30 rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--anchor-border-subtle)] text-[var(--anchor-danger)]">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold">
            Danger Zone
          </h3>
          <p className="text-xs text-[var(--anchor-text-muted)]">
            Irreversible local client actions.
          </p>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)]">
          <div>
            <span className="font-semibold text-[var(--anchor-text)] block">
              Clear Local Client Cache
            </span>
            <span className="text-[11px] text-[var(--anchor-text-subtle)]">
              Resets UI window states, cached indices, and temporary local buffers.
            </span>
          </div>
          <Button
            size="xs"
            variant="outline"
            icon={<Trash2 className="w-3.5 h-3.5 text-[var(--anchor-danger)]" />}
            onClick={handleClearCache}
          >
            Clear Cache
          </Button>
        </div>

        {syncStatus?.driveConnected && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)]">
            <div>
              <span className="font-semibold text-[var(--anchor-text)] block">
                Disconnect Google Drive
              </span>
              <span className="text-[11px] text-[var(--anchor-text-subtle)]">
                Stops cloud synchronization with your Google Drive database.
              </span>
            </div>
            <Button
              size="xs"
              variant="outline"
              icon={<CloudOff className="w-3.5 h-3.5 text-[var(--anchor-danger)]" />}
              onClick={handleDisconnect}
            >
              Disconnect Drive
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
