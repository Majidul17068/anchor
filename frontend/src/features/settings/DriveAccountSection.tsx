import React, { useEffect } from 'react';
import { useSyncStore } from '../../store/sync';
import { DriveStatus } from '../sync/DriveStatus';

/**
 * Settings: which Google Drive Anchor uses. The same card as on the Sync
 * page, so connecting, changing the account and disconnecting are found
 * where people look for account settings.
 */
export const DriveAccountSection: React.FC = () => {
  const status = useSyncStore((s) => s.status);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const loadSyncState = useSyncStore((s) => s.loadSyncState);
  const syncNow = useSyncStore((s) => s.syncNow);
  const connectDrive = useSyncStore((s) => s.connectDrive);
  const disconnectDrive = useSyncStore((s) => s.disconnectDrive);

  useEffect(() => {
    void loadSyncState();
  }, [loadSyncState]);

  return <DriveStatus status={status} isSyncing={isSyncing} onSyncNow={syncNow} onConnect={connectDrive} onDisconnect={disconnectDrive} />;
};
