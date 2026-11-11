import React, { useState } from 'react';
import type { Conflict } from '../../bridge/types';
import { useSessionStore } from '../../store/session';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { CodeBlock } from '../../components/CodeBlock';
import { AlertTriangle, Check, GitMerge, Laptop } from 'lucide-react';

export interface ConflictListProps {
  conflicts: Conflict[];
  onResolve: (sessionId: string, as: 'parent' | 'merged') => Promise<void>;
}

export const ConflictList: React.FC<ConflictListProps> = ({ conflicts, onResolve }) => {
  const sessions = useSessionStore((s) => s.sessions);
  const [inspectConflict, setInspectConflict] = useState<Conflict | null>(null);

  if (conflicts.length === 0) return null;

  return (
    <div className="p-4 rounded-xl border border-[var(--anchor-danger)]/40 bg-[var(--anchor-danger-subtle)]/30 text-left space-y-3">
      <div className="flex items-center gap-2 text-[var(--anchor-danger)] font-semibold text-xs">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Sync Conflict Detected ({conflicts.length})</span>
      </div>

      <div className="space-y-2">
        {conflicts.map((c) => {
          const sess = sessions.find((s) => s.id === c.sessionId);
          return (
            <div
              key={c.sessionId}
              className="p-3 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-lg flex items-center justify-between gap-3 text-xs shadow-xs"
            >
              <div className="space-y-1">
                <span className="font-semibold text-[var(--anchor-text)] block">
                  {sess?.title || c.sessionId}
                </span>
                <span className="text-[11px] text-[var(--anchor-text-subtle)]">
                  Devices with concurrent edits: <strong>{c.devices.join(' and ')}</strong>
                </span>
                {c.resolvedAs && (
                  <Badge variant="ok" size="xs">
                    Resolved as: {c.resolvedAs}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setInspectConflict(c)}
                >
                  View Both Versions
                </Button>
                {!c.resolvedAs && (
                  <>
                    <Button
                      size="xs"
                      variant="primary"
                      icon={<Laptop className="w-3 h-3" />}
                      onClick={() => onResolve(c.sessionId, 'parent')}
                    >
                      Parent Wins
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      icon={<GitMerge className="w-3 h-3" />}
                      onClick={() => onResolve(c.sessionId, 'merged')}
                    >
                      Auto-Merge
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {inspectConflict && (
        <Dialog
          open={true}
          onClose={() => setInspectConflict(null)}
          title={`Conflict Inspection: ${inspectConflict.sessionId}`}
          description="Compare changes recorded on Parent Source versus Replica Device."
          maxWidth="xl"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onResolve(inspectConflict.sessionId, 'parent');
                  setInspectConflict(null);
                }}
              >
                Accept Parent Version
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onResolve(inspectConflict.sessionId, 'merged');
                  setInspectConflict(null);
                }}
              >
                Merge Both
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-semibold text-[var(--anchor-warn)] block mb-1">
                MacBook Pro (Parent Source)
              </span>
              <CodeBlock
                code={`// Parent Source Snapshot\nexport const authContext = {\n  version: 2,\n  pkceToken: "pkce_verified_macbook",\n  timestamp: "${new Date().toISOString()}"\n};`}
                language="typescript"
              />
            </div>
            <div>
              <span className="font-semibold text-[var(--anchor-info)] block mb-1">
                Home Workstation (Replica)
              </span>
              <CodeBlock
                code={`// Replica Snapshot\nexport const authContext = {\n  version: 2,\n  pkceToken: "pkce_verified_workstation",\n  timestamp: "${new Date(Date.now() - 3600000).toISOString()}"\n};`}
                language="typescript"
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
