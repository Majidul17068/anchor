import React from 'react';
import { useSettingsStore } from '../../store/settings';
import { Button } from '../../components/Button';
import { CheckCircle2, Download, FolderSearch, Terminal } from 'lucide-react';

export interface StepCliInstallProps {
  onComplete: () => void;
  isCompleted: boolean;
}

export const StepCliInstall: React.FC<StepCliInstallProps> = ({ onComplete, isCompleted }) => {
  const cliStatus = useSettingsStore((s) => s.cliStatus);
  const installingCli = useSettingsStore((s) => s.installingCli);
  const installProgress = useSettingsStore((s) => s.installProgress);
  const installCli = useSettingsStore((s) => s.installCli);
  const locateCli = useSettingsStore((s) => s.locateCli);

  const handleInstall = async () => {
    await installCli();
    onComplete();
  };

  const handleLocate = async () => {
    const path = await locateCli();
    if (path) {
      onComplete();
    }
  };

  return (
    <div className="flex flex-col gap-3 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-[var(--anchor-accent)]" />
          <h4 className="text-sm font-semibold text-[var(--anchor-text)]">
            1. Setting up Antigravity CLI
          </h4>
        </div>
        {isCompleted && (
          <span className="flex items-center gap-1 text-xs text-[var(--anchor-ok)] font-medium">
            <CheckCircle2 className="w-4 h-4" /> Ready
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">
        Anchor communicates directly with Google&apos;s Antigravity CLI (<code className="font-mono text-[11px] text-[var(--anchor-accent)]">agy</code>) to execute agent loops, model calls, and local workspaces.
      </p>

      {installingCli ? (
        <div className="p-3 bg-[var(--anchor-surface-sunken)] rounded-lg border border-[var(--anchor-border)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--anchor-text)] font-medium">
              {installProgress?.message || 'Installing...'}
            </span>
            <span className="font-mono text-[var(--anchor-text-subtle)]">
              {installProgress?.percent || 0}%
            </span>
          </div>
          <div className="w-full bg-[var(--anchor-surface)] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[var(--anchor-accent)] h-full transition-all duration-300 rounded-full"
              style={{ width: `${installProgress?.percent || 10}%` }}
            />
          </div>
        </div>
      ) : cliStatus?.installed ? (
        <div className="flex items-center justify-between p-3 bg-[var(--anchor-surface-sunken)] rounded-lg border border-[var(--anchor-border)]">
          <div className="flex flex-col">
            <span className="text-xs font-mono text-[var(--anchor-text)]">
              {cliStatus.path}
            </span>
            <span className="text-[11px] text-[var(--anchor-text-subtle)]">
              Installed: {cliStatus.version}
            </span>
          </div>
          <Button size="xs" variant="outline" onClick={onComplete}>
            Next Step
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleInstall}
          >
            Download & Install CLI Automatically
          </Button>
          <button
            onClick={handleLocate}
            className="flex items-center gap-1 text-xs text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-accent)] transition-colors cursor-pointer"
          >
            <FolderSearch className="w-3.5 h-3.5" />
            Locate binary manually
          </button>
        </div>
      )}
    </div>
  );
};
