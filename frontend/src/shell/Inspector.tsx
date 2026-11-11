import React from 'react';
import { useChatStore } from '../store/chat';
import { CodeBlock } from '../components/CodeBlock';
import { Badge } from '../components/Badge';
import { Check, Copy, ExternalLink, HardDrive, Info, Terminal, X } from 'lucide-react';
import { formatDuration } from '../lib/format';

export const Inspector: React.FC = () => {
  const inspectorContent = useChatStore((s) => s.inspectorContent);
  const closeInspector = useChatStore((s) => s.closeInspector);

  if (!inspectorContent) return null;

  const { type, title, data } = inspectorContent;

  return (
    <aside
      aria-label="Details inspector"
      className="w-96 bg-[var(--anchor-surface)] border-l border-[var(--anchor-border)] flex flex-col h-full overflow-hidden shrink-0 z-20 animate-in slide-in-from-right-4 duration-150"
    >
      {/* Inspector Header */}
      <div className="h-12 px-4 border-b border-[var(--anchor-border)] flex items-center justify-between shrink-0 bg-[var(--anchor-surface-elevated)]">
        <div className="flex items-center gap-2 overflow-hidden">
          {type === 'tool' && <Terminal className="w-4 h-4 text-[var(--anchor-accent)] shrink-0" />}
          {type === 'diff' && <Info className="w-4 h-4 text-[var(--anchor-info)] shrink-0" />}
          {type === 'device' && <HardDrive className="w-4 h-4 text-[var(--anchor-warn)] shrink-0" />}
          <span className="font-semibold text-xs text-[var(--anchor-text)] truncate">{title}</span>
        </div>
        <button
          onClick={closeInspector}
          aria-label="Close inspector"
          className="text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] p-1 rounded hover:bg-[var(--anchor-surface-hover)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-left">
        {type === 'tool' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--anchor-text-subtle)]">Tool Name</span>
              <Badge variant="accent" size="xs">
                {data.tool}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--anchor-text-subtle)]">Execution Status</span>
              <Badge
                variant={
                  data.status === 'ok'
                    ? 'ok'
                    : data.status === 'error' || data.status === 'denied'
                    ? 'danger'
                    : 'warn'
                }
                size="xs"
              >
                {data.status}
              </Badge>
            </div>

            {data.durationMs !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--anchor-text-subtle)]">Duration</span>
                <span className="font-mono text-[var(--anchor-text-muted)]">
                  {formatDuration(data.durationMs)}
                </span>
              </div>
            )}

            <div>
              <span className="text-[var(--anchor-text-subtle)] font-medium mb-1 block">
                Arguments Payload
              </span>
              <CodeBlock
                code={typeof data.args === 'string' ? data.args : JSON.stringify(data.args, null, 2)}
                language="json"
              />
            </div>

            {data.output && (
              <div>
                <span className="text-[var(--anchor-text-subtle)] font-medium mb-1 block">
                  CLI Output / Result
                </span>
                <CodeBlock code={data.output} language="text" />
              </div>
            )}
          </div>
        )}

        {type === 'diff' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--anchor-text-subtle)]">File Path</span>
              <span className="font-mono text-[11px] text-[var(--anchor-text)]">{data.path}</span>
            </div>
            <div>
              <span className="text-[var(--anchor-text-subtle)] font-medium mb-1 block">
                Patch Diff
              </span>
              <CodeBlock code={data.patch} language="diff" />
            </div>
          </div>
        )}

        {type === 'device' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--anchor-text-subtle)]">Device Name</span>
              <span className="font-medium text-[var(--anchor-text)]">{data.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--anchor-text-subtle)]">Platform</span>
              <span className="font-mono text-[var(--anchor-text-muted)]">{data.platform}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--anchor-text-subtle)]">Role</span>
              <Badge variant={data.isThisDevice ? 'warn' : 'default'} size="xs">
                {data.isThisDevice ? 'Parent Source (This Device)' : 'Replica Device'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--anchor-text-subtle)]">Last Heartbeat</span>
              <span className="text-[var(--anchor-text-muted)]">{new Date(data.lastSeen).toLocaleString()}</span>
            </div>
          </div>
        )}

        {type === 'skill' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--anchor-text-subtle)]">Skill Name</span>
              <span className="font-medium text-[var(--anchor-text)]">{data.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--anchor-text-subtle)]">Version</span>
              <Badge variant="accent" size="xs">v{data.version}</Badge>
            </div>
            {data.files && data.files.length > 0 && (
              <div>
                <span className="text-[var(--anchor-text-subtle)] font-medium mb-1 block">
                  File Preview: {data.files[0].path}
                </span>
                <CodeBlock code={data.files[0].content} language="markdown" />
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
