import React from 'react';
import { useSyncStore } from '../../store/sync';
import { Button } from '../../components/Button';
import { CheckCircle2, HardDrive, ShieldCheck } from 'lucide-react';

export interface StepDriveProps {
  onComplete: () => void;
  isCompleted: boolean;
}

export const StepDrive: React.FC<StepDriveProps> = ({ onComplete, isCompleted }) => {
  const syncStatus = useSyncStore((s) => s.status);
  const connectDrive = useSyncStore((s) => s.connectDrive);
  const isSyncing = useSyncStore((s) => s.isSyncing);

  const handleConnect = async () => {
    await connectDrive();
    onComplete();
  };

  return (
    <div className="flex flex-col gap-3 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-[var(--anchor-accent)]" />
          <h4 className="text-sm font-semibold text-[var(--anchor-text)]">
            4. Connect Google Drive for sync (Optional)
          </h4>
        </div>
        {isCompleted && syncStatus?.driveConnected && (
          <span className="flex items-center gap-1 text-xs text-[var(--anchor-ok)] font-medium">
            <CheckCircle2 className="w-4 h-4" /> Connected
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">
        Anchor uses your Google Drive hidden <code className="font-mono text-[11px] text-[var(--anchor-accent)]">appDataFolder</code> as your personal, end-to-end synchronized database. No third-party servers ever touch your sessions, tokens, or custom skills.
      </p>

      <div className="flex items-center gap-2 p-2.5 bg-[var(--anchor-surface-sunken)] rounded-lg border border-[var(--anchor-border)] text-xs text-[var(--anchor-text-subtle)]">
        <ShieldCheck className="w-4 h-4 text-[var(--anchor-ok)] shrink-0" />
        <span>Restricted App-Data Scope: Anchor can only view and write files it creates itself.</span>
      </div>

      <div className="flex items-center gap-3 pt-1">
        {syncStatus?.driveConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--anchor-ok)] font-medium">
              Connected as {syncStatus.driveEmail || 'Primary Account'}
            </span>
            <Button size="xs" variant="outline" onClick={onComplete}>
              Continue
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              loading={isSyncing}
              onClick={handleConnect}
            >
              Connect Google Drive Storage
            </Button>
            <Button variant="ghost" size="sm" onClick={onComplete}>
              Skip for now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
