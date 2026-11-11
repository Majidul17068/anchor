import React, { useState } from 'react';
import { useSettingsStore } from '../../store/settings';
import { Button } from '../../components/Button';
import { Switch } from '../../components/Switch';
import { Badge } from '../../components/Badge';
import { Check, Download, RefreshCw, Terminal } from 'lucide-react';

export const CliSection: React.FC = () => {
  const cliStatus = useSettingsStore((s) => s.cliStatus);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const checkCli = useSettingsStore((s) => s.checkCli);
  const installCli = useSettingsStore((s) => s.installCli);
  const installingCli = useSettingsStore((s) => s.installingCli);
  const installProgress = useSettingsStore((s) => s.installProgress);

  const [checking, setChecking] = useState(false);

  const handleCheckUpdate = async () => {
    setChecking(true);
    await checkCli();
    setTimeout(() => setChecking(false), 600);
  };

  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--anchor-border-subtle)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-accent)]">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--anchor-text)]">
              Antigravity CLI (agy) Configuration
            </h3>
            <p className="text-xs text-[var(--anchor-text-muted)]">
              Binary runtime daemon controlling local code execution and models.
            </p>
          </div>
        </div>

        <Badge variant={cliStatus?.installed ? 'ok' : 'danger'} size="xs">
          {cliStatus?.installed ? 'Installed & Linked' : 'CLI Missing'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-[11px] text-[var(--anchor-text-subtle)] block">
            Binary Executable Path
          </span>
          <span className="font-mono text-[var(--anchor-text)] bg-[var(--anchor-surface-sunken)] px-2 py-1 rounded border border-[var(--anchor-border)] block mt-1 truncate">
            {cliStatus?.path || '/usr/local/bin/agy'}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-[var(--anchor-text-subtle)] block">
            Detected Runtime Version
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[var(--anchor-text)] bg-[var(--anchor-surface-sunken)] px-2 py-1 rounded border border-[var(--anchor-border)] truncate">
              {cliStatus?.version || 'Unknown version'}
            </span>
            {cliStatus?.updateAvailable && (
              <Badge variant="warn" size="xs">
                Update to v{cliStatus.updateAvailable}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {installingCli && (
        <div className="p-3 bg-[var(--anchor-surface-sunken)] rounded-xl border border-[var(--anchor-border)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--anchor-text)] font-medium">
              {installProgress?.message || 'Updating CLI...'}
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
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[var(--anchor-border-subtle)]">
        <Switch
          label="Telemetry & Crash Reports"
          description="Send anonymous stack traces directly to Google Antigravity engineering team"
          checked={Boolean(settings.telemetryEnabled)}
          onChange={(checked) => updateSettings({ telemetryEnabled: checked })}
        />

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            loading={checking}
            icon={<RefreshCw className="w-3 h-3" />}
            onClick={handleCheckUpdate}
          >
            Check for Update
          </Button>
          {cliStatus?.updateAvailable && (
            <Button
              size="xs"
              variant="primary"
              loading={installingCli}
              icon={<Download className="w-3 h-3" />}
              onClick={installCli}
            >
              Update to {cliStatus.updateAvailable}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
