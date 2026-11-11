import React from 'react';
import { useSkillsStore } from '../../store/skills';
import { confirmDialog } from '../../store/confirm';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { formatRelativeDate } from '../../lib/format';
import { History, RotateCcw } from 'lucide-react';

export interface VersionListProps {
  skillId: string;
  currentVersion: string;
}

export const VersionList: React.FC<VersionListProps> = ({ skillId, currentVersion }) => {
  const versionHistory = useSkillsStore((s) => s.versionHistory);
  const rollbackVersion = useSkillsStore((s) => s.rollbackVersion);

  const handleRollback = async (ver: string) => {
    const ok = await confirmDialog({
      title: `Roll back to version ${ver}?`,
      message: 'Restores that version’s SKILL.md and files. The current version is kept in history.',
      confirmLabel: 'Roll back',
    });
    if (ok) await rollbackVersion(skillId, ver);
  };

  return (
    <div className="p-4 space-y-4 text-left">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-[var(--anchor-accent)]" />
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
          Revision History & Rollbacks
        </span>
      </div>

      <div className="space-y-2">
        {versionHistory.map((item) => {
          const isCurrent = item.version === currentVersion;
          return (
            <div
              key={item.version}
              className="p-3 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-xl flex items-center justify-between gap-4 text-xs shadow-xs"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <Badge variant={isCurrent ? 'accent' : 'default'} size="xs">
                    v{item.version}
                  </Badge>
                  {isCurrent && <span className="text-[10px] text-[var(--anchor-ok)] font-medium">Active</span>}
                  <span className="text-[11px] text-[var(--anchor-text-subtle)] font-mono">
                    {formatRelativeDate(item.at)}
                  </span>
                </div>
                <span className="text-xs text-[var(--anchor-text)] mt-1 font-medium">
                  {item.summary}
                </span>
              </div>

              {!isCurrent && (
                <Button
                  size="xs"
                  variant="outline"
                  icon={<RotateCcw className="w-3 h-3" />}
                  onClick={() => handleRollback(item.version)}
                >
                  Rollback
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
