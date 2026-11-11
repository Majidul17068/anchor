import React from 'react';
import type { Skill } from '../../bridge/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { formatRelativeDate } from '../../lib/format';
import {
  CheckCircle2,
  Edit,
  FileCode,
  Layers,
  Share2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SkillCardProps {
  skill: Skill;
  isSelected?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onShare?: () => void;
  onTrain?: () => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  isSelected,
  onSelect,
  onEdit,
  onShare,
  onTrain,
}) => {
  const passingCount = skill.examples.filter((e) => e.lastResult?.pass).length;
  const totalExamples = skill.examples.length;

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
            <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-info)] shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--anchor-text)] truncate">
                {skill.name}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-[var(--anchor-text-subtle)]">
                <span>v{skill.version}</span>
                <span>•</span>
                <span className="truncate">by {skill.author}</span>
              </div>
            </div>
          </div>
          <Badge variant={skill.source === 'mine' ? 'accent' : 'info'} size="xs">
            {skill.source}
          </Badge>
        </div>

        <p className="text-xs text-[var(--anchor-text-muted)] line-clamp-2 leading-relaxed mb-3">
          {skill.description}
        </p>

        {/* Triggers chips */}
        {skill.triggers.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {skill.triggers.slice(0, 3).map((tr, i) => (
              <span
                key={i}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border-subtle)] text-[10px] font-mono text-[var(--anchor-text-subtle)]"
              >
                <Zap className="w-2.5 h-2.5 text-[var(--anchor-accent)]" />
                {tr}
              </span>
            ))}
            {skill.triggers.length > 3 && (
              <span className="text-[10px] text-[var(--anchor-text-subtle)] self-center font-mono">
                +{skill.triggers.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-[var(--anchor-border-subtle)] space-y-3">
        <div className="flex items-center justify-between text-[11px] text-[var(--anchor-text-subtle)]">
          <div className="flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5" />
            <span>{skill.files.length} files</span>
          </div>

          {totalExamples > 0 ? (
            <div className="flex items-center gap-1 text-[var(--anchor-ok)] font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>
                {passingCount}/{totalExamples} tests pass
              </span>
            </div>
          ) : (
            <span>No tests yet</span>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">
            {formatRelativeDate(skill.updatedAt)}
          </span>

          <div className="flex items-center gap-1">
            {onShare && (
              <Button
                size="xs"
                variant="ghost"
                icon={<Share2 className="w-3.5 h-3.5" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onShare();
                }}
              />
            )}
            {onTrain && (
              <Button
                size="xs"
                variant="ghost"
                icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onTrain();
                }}
              />
            )}
            <Button
              size="xs"
              variant="outline"
              icon={<Edit className="w-3.5 h-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              Open
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
