import React from 'react';
import { useSessionStore } from '../../store/session';
import { useSyncStore } from '../../store/sync';
import { Switch } from '../../components/Switch';
import { Tooltip } from '../../components/Tooltip';
import { Cloud, CloudOff } from 'lucide-react';

export const SyncToggle: React.FC = () => {
  const activeSession = useSessionStore((s) => s.activeSession);
  const toggleSync = useSessionStore((s) => s.toggleSync);
  const thisDevice = useSyncStore((s) => s.thisDevice);

  if (!activeSession) return null;

  const isParent = activeSession.originDeviceId === thisDevice?.id;

  const switchElement = (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-xs">
      {activeSession.syncEnabled ? (
        <Cloud className="w-3.5 h-3.5 text-[var(--anchor-ok)] shrink-0" />
      ) : (
        <CloudOff className="w-3.5 h-3.5 text-[var(--anchor-text-subtle)] shrink-0" />
      )}
      <span className="text-[11px] font-medium text-[var(--anchor-text-muted)]">
        Sync
      </span>
      <Switch
        checked={activeSession.syncEnabled}
        disabled={!isParent}
        onChange={() => toggleSync(activeSession.id)}
      />
    </div>
  );

  if (!isParent) {
    return (
      <Tooltip
        side="bottom"
        content="Only the parent source controls sync"
      >
        <div className="cursor-not-allowed opacity-60">
          {switchElement}
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      side="bottom"
      content={activeSession.syncEnabled ? 'Session synchronized to Google Drive' : 'Session is local only'}
    >
      {switchElement}
    </Tooltip>
  );
};
