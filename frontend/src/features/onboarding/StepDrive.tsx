import React from 'react';
import { useSyncStore } from '../../store/sync';
import { Button } from '../../components/Button';
import { DriveHelp, folderKindLabel } from '../sync/DriveHelp';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export interface StepDriveProps {
  onComplete: () => void;
  isCompleted: boolean;
}

export const StepDrive: React.FC<StepDriveProps> = ({ onComplete, isCompleted }) => {
  const syncStatus = useSyncStore((s) => s.status);
  const connectDrive = useSyncStore((s) => s.connectDrive);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const error = useSyncStore((s) => s.error);

  const handleConnect = async () => {
    await connectDrive();
    if (useSyncStore.getState().status?.driveConnected) onComplete();
  };

  return (
    <div className="flex flex-col gap-3 text-left">
      {isCompleted && syncStatus?.driveConnected && (
        <span className="flex items-center gap-1 text-xs text-[var(--anchor-ok)] font-medium">
          <CheckCircle2 className="w-4 h-4" /> Connected
        </span>
      )}

      <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">
        Connecting creates an <code className="font-mono text-[11px] text-[var(--anchor-accent)]">Anchor</code> folder in your own Google Drive. Sessions you switch Sync on for are saved there under <code className="font-mono text-[11px] text-[var(--anchor-accent)]">Anchor/year/month/day</code>; any other device signed in to the same account can pull them and continue. No third-party servers touch your sessions, tokens, or skills.
      </p>

      <div className="flex items-center gap-2 p-2.5 bg-[var(--anchor-surface-sunken)] rounded-lg border border-[var(--anchor-border)] text-xs text-[var(--anchor-text-subtle)]">
        <ShieldCheck className="w-4 h-4 text-[var(--anchor-ok)] shrink-0" />
        <span>Limited scope: Anchor can only see and write files it created itself. You grant access once; later launches reuse it.</span>
      </div>

      <div className="flex items-center gap-3 pt-1">
        {syncStatus?.driveConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--anchor-ok)] font-medium">
              {syncStatus.backend === 'folder' ? (
                <span title={syncStatus.folderPath}>
                  Connected · Anchor folder in your {folderKindLabel(syncStatus.folderKind)}
                  {syncStatus.driveEmail ? ` (${syncStatus.driveEmail})` : ''}
                </span>
              ) : (
                `Connected as ${syncStatus.driveEmail || 'Primary Account'}`
              )}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              loading={isSyncing}
              onClick={handleConnect}
            >
              Connect Google Drive
            </Button>
          </div>
        )}
      </div>

      {error && <DriveHelp error={error} />}
    </div>
  );
};
