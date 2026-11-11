import React, { useState } from 'react';
import { useChatStore } from '../../store/chat';
import { Badge } from '../../components/Badge';
import { formatDuration } from '../../lib/format';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Terminal,
} from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ToolCallCardProps {
  tool: string;
  args: unknown;
  status: 'pending' | 'running' | 'ok' | 'error' | 'denied';
  output?: string;
  durationMs?: number;
  className?: string;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({
  tool,
  args,
  status,
  output,
  durationMs,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const openInspector = useChatStore((s) => s.openInspector);

  const handleInspect = (e: React.MouseEvent) => {
    e.stopPropagation();
    openInspector({
      type: 'tool',
      title: `Tool: ${tool}`,
      data: { tool, args, status, output, durationMs },
    });
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="warn" size="xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--anchor-warn)] animate-ping mr-1" />
            Running
          </Badge>
        );
      case 'ok':
        return <Badge variant="ok" size="xs">Done</Badge>;
      case 'error':
        return <Badge variant="danger" size="xs">Failed</Badge>;
      case 'denied':
        return <Badge variant="danger" size="xs">Denied</Badge>;
      default:
        return <Badge variant="default" size="xs">Pending</Badge>;
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] text-xs text-left overflow-hidden my-2',
        className
      )}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 py-2 bg-[var(--anchor-surface-elevated)] hover:bg-[var(--anchor-surface-hover)] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-[var(--anchor-accent)] shrink-0" />
          <span className="font-mono font-medium text-[var(--anchor-text)] truncate">
            {tool}
          </span>
          {getStatusBadge()}
          {durationMs !== undefined && (
            <span className="font-mono text-[10px] text-[var(--anchor-text-subtle)]">
              {formatDuration(durationMs)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInspect}
            aria-label="Open in inspector"
            className="flex items-center gap-1 text-[11px] text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-accent)] p-1 rounded hover:bg-[var(--anchor-surface-active)] transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">Inspect</span>
          </button>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-[var(--anchor-text-subtle)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--anchor-text-subtle)]" />}
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-2 border-t border-[var(--anchor-border)] font-mono text-[11px] selectable">
          <div>
            <span className="text-[var(--anchor-text-subtle)] block text-[10px] uppercase font-bold mb-0.5">
              Arguments
            </span>
            <pre className="p-2 rounded bg-[var(--anchor-surface)] text-[var(--anchor-text)] overflow-x-auto">
              {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {output && (
            <div>
              <span className="text-[var(--anchor-text-subtle)] block text-[10px] uppercase font-bold mb-0.5">
                Output
              </span>
              <pre className="p-2 rounded bg-[var(--anchor-surface)] text-[var(--anchor-text-muted)] overflow-x-auto max-h-48">
                {output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
