import React from 'react';
import { useChatStore } from '../../store/chat';
import { Button } from '../../components/Button';
import { CodeBlock } from '../../components/CodeBlock';
import { Badge } from '../../components/Badge';
import { Check, FileCode, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface DiffCardProps {
  sessionId: string;
  stepId: string;
  path: string;
  patch: string;
  accepted?: boolean;
  className?: string;
}

export const DiffCard: React.FC<DiffCardProps> = ({
  sessionId,
  stepId,
  path,
  patch,
  accepted,
  className,
}) => {
  const resolveDiff = useChatStore((s) => s.resolveDiff);

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] p-3 text-xs text-left my-2 overflow-hidden',
        className
      )}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[var(--anchor-border-subtle)]">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[var(--anchor-info)]" />
          <span className="font-mono text-xs font-semibold text-[var(--anchor-text)]">
            {path}
          </span>
        </div>

        {accepted !== undefined ? (
          <Badge variant={accepted ? 'ok' : 'danger'} size="xs">
            {accepted ? 'Patch Accepted' : 'Patch Rejected'}
          </Badge>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              icon={<Check className="w-3 h-3 text-[var(--anchor-ok)]" />}
              onClick={() => resolveDiff(sessionId, stepId, true)}
            >
              Accept
            </Button>
            <Button
              size="xs"
              variant="outline"
              icon={<X className="w-3 h-3 text-[var(--anchor-danger)]" />}
              onClick={() => resolveDiff(sessionId, stepId, false)}
            >
              Reject
            </Button>
          </div>
        )}
      </div>

      <div className="pt-2">
        <CodeBlock code={patch} language="diff" />
      </div>
    </div>
  );
};
