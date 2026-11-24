import React from 'react';
import type { Agent } from '../../bridge/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { AlertTriangle, Bot, Cpu, Layers, Play, Settings, Upload } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface AgentCardProps {
  agent: Agent;
  isSelected?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onTest: () => void;
  /** Share this agent on the Anchor Marketplace (your own agents only). */
  onShare?: () => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isSelected,
  onSelect,
  onEdit,
  onTest,
  onShare,
}) => {
  const hidden = agent.discovered === false;
  const sourceColors = {
    builtin: 'default',
    plugin: 'accent',
    mine: 'warn',
    shared: 'info',
  } as const;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex flex-col justify-between p-4 rounded-xl border bg-[var(--anchor-surface)] transition-all cursor-pointer text-left',
        isSelected
          ? 'border-[var(--anchor-accent)] ring-1 ring-[var(--anchor-accent)] shadow-md'
          : 'border-[var(--anchor-border)] hover:border-[var(--anchor-border-focus)] hover:bg-[var(--anchor-surface-elevated)]'
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-accent)] shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--anchor-text)] truncate">
                {agent.name}
              </h3>
              <Badge variant={sourceColors[agent.source]} size="xs">
                {agent.source}
              </Badge>
            </div>
          </div>
          {hidden && (
            <span title="The Antigravity CLI does not list this agent, so Test cannot run it. Open Configure and save it again to rewrite the file.">
              <Badge variant="warn" size="xs">
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                Not seen by CLI
              </Badge>
            </span>
          )}
        </div>

        <p className="text-xs text-[var(--anchor-text-muted)] line-clamp-2 leading-relaxed mb-4">
          {agent.description}
        </p>
      </div>

      <div className="pt-3 border-t border-[var(--anchor-border-subtle)] space-y-3">
        <div className="flex items-center justify-between text-[11px] text-[var(--anchor-text-subtle)]">
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono">{agent.modelId.replace('gemini-', 'g-').replace('claude-', 'c-')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            <span>{agent.skillIds.length} skills</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {onShare && agent.source === 'mine' && (
            <Button
              size="xs"
              variant="ghost"
              icon={<Upload className="w-3.5 h-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
            >
              Share
            </Button>
          )}
          <Button
            size="xs"
            variant="outline"
            icon={<Settings className="w-3.5 h-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            Configure
          </Button>
          <Button
            size="xs"
            variant="primary"
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={(e) => {
              e.stopPropagation();
              onTest();
            }}
          >
            Test
          </Button>
        </div>
      </div>
    </div>
  );
};
