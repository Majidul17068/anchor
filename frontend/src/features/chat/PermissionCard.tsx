import React from 'react';
import { useChatStore } from '../../store/chat';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { AlertCircle, CheckCircle, ShieldAlert, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface PermissionCardProps {
  sessionId: string;
  stepId: string;
  tool: string;
  description: string;
  resolved?: 'once' | 'always' | 'deny';
  className?: string;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({
  sessionId,
  stepId,
  tool,
  description,
  resolved,
  className,
}) => {
  const resolvePermission = useChatStore((s) => s.resolvePermission);

  const handleDecision = (decision: 'once' | 'always' | 'deny') => {
    resolvePermission(sessionId, stepId, decision);
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--anchor-warn)]/40 bg-[var(--anchor-warn-subtle)] p-4 text-xs text-left my-3 shadow-xs',
        resolved && 'border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)]',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[var(--anchor-warn)]/20 text-[var(--anchor-warn)] shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-[var(--anchor-text)]">
              Action Approval Required
            </span>
            <Badge variant="warn" size="xs">
              {tool}
            </Badge>
          </div>

          <p className="text-xs text-[var(--anchor-text)] leading-relaxed">
            {description}
          </p>

          {resolved ? (
            <div className="flex items-center gap-2 pt-1 text-[11px] font-medium">
              {resolved === 'deny' ? (
                <span className="flex items-center gap-1 text-[var(--anchor-danger)]">
                  <XCircle className="w-3.5 h-3.5" /> Denied by user
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[var(--anchor-ok)]">
                  <CheckCircle className="w-3.5 h-3.5" /> Allowed ({resolved})
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="xs"
                onClick={() => handleDecision('once')}
              >
                Allow once
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleDecision('always')}
              >
                Allow always
              </Button>
              <Button
                variant="danger"
                size="xs"
                onClick={() => handleDecision('deny')}
              >
                Deny
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
