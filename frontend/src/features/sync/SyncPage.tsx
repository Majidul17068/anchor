import React, { useEffect } from 'react';
import { useSyncStore } from '../../store/sync';
import { useSessionStore } from '../../store/session';
import { DriveStatus } from './DriveStatus';
import { DeviceCard } from './DeviceCard';
import { ConflictList } from './ConflictList';
import { RulesPanel } from './RulesPanel';
import { DriveSessions } from './DriveSessions';
import { HardDrive } from 'lucide-react';

export const SyncPage: React.FC = () => {
  const status = useSyncStore((s) => s.status);
  const devices = useSyncStore((s) => s.devices);
  const thisDevice = useSyncStore((s) => s.thisDevice);
  const conflicts = useSyncStore((s) => s.conflicts);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const loadSyncState = useSyncStore((s) => s.loadSyncState);
  const syncNow = useSyncStore((s) => s.syncNow);
  const connectDrive = useSyncStore((s) => s.connectDrive);
  const disconnectDrive = useSyncStore((s) => s.disconnectDrive);
  const resolveConflict = useSyncStore((s) => s.resolveConflict);
  const renameDevice = useSyncStore((s) => s.renameDevice);

  const sessions = useSessionStore((s) => s.sessions);
  const loadSessions = useSessionStore((s) => s.loadSessions);

  useEffect(() => {
    loadSyncState();
    loadSessions();
  }, [loadSyncState, loadSessions]);

  const countSessionsForDevice = (deviceId: string) => {
    return sessions.filter((s) => s.originDeviceId === deviceId).length;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left max-w-6xl mx-auto w-full">
      {/* Top Drive Status & Actions */}
      <DriveStatus
        status={status}
        isSyncing={isSyncing}
        onSyncNow={syncNow}
        onConnect={connectDrive}
        onDisconnect={disconnectDrive}
      />

      {/* Conflict Log Banner */}
      <ConflictList
        conflicts={conflicts}
        onResolve={resolveConflict}
      />

      {/* Sessions other devices saved to Drive, pulled on demand */}
      <DriveSessions />

      {/* Rules Explanation Panel */}
      <RulesPanel />

      {/* Device Mesh List */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-[var(--anchor-accent)]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
            Connected Device Mesh ({devices.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((dev) => (
            <DeviceCard
              key={dev.id}
              device={dev}
              sessionCount={countSessionsForDevice(dev.id)}
              onRename={dev.isThisDevice ? renameDevice : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
