import React from 'react';
import type { Session } from '../../bridge/types';
import { useSessionStore } from '../../store/session';
import { formatRelativeDate } from '../../lib/format';
import { Badge } from '../../components/Badge';
import {
  AlertTriangle,
  Cloud,
  HardDrive,
  Laptop,
  Pin,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SessionRowProps {
  session: Session;
  isActive: boolean;
  thisDeviceId?: string;
  onSelect: () => void;
}

export const SessionRow: React.FC<SessionRowProps> = ({
  session,
  isActive,
  thisDeviceId,
  onSelect,
}) => {
  const updateSession = useSessionStore((s) => s.updateSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);

  const isParent = session.originDeviceId === thisDeviceId;

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateSession(session.id, { pinned: !session.pinned });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete session "${session.title}"?`)) {
      deleteSession(session.id);
    }
  };

  const getSyncDot = () => {
    if (session.syncState === 'conflict') {
      return (
        <span
          title="Sync conflict detected"
          className="w-2 h-2 rounded-full bg-[var(--anchor-danger)] ring-2 ring-[var(--anchor-danger)]/20 animate-pulse"
        />
      );
    }
    if (session.syncState === 'published') {
      return (
        <span
          title="Synced to Google Drive"
          className="w-2 h-2 rounded-full bg-[var(--anchor-ok)]"
        />
      );
    }
    if (session.syncState === 'replica') {
      return (
        <span
          title="Replica synced from other device"
          className="w-2 h-2 rounded-full bg-[var(--anchor-info)]"
        />
      );
    }
    return (
      <span
        title="Local session (unsynced)"
        className="w-2 h-2 rounded-full bg-[var(--anchor-text-subtle)]"
      />
    );
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col gap-1 p-2.5 rounded-lg cursor-pointer transition-all border text-left',
        isActive
          ? 'bg-[var(--anchor-surface-elevated)] border-[var(--anchor-border)] shadow-xs'
          : 'bg-transparent border-transparent hover:bg-[var(--anchor-surface-hover)]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {getSyncDot()}
          <span
            className={cn(
              'text-xs font-medium truncate',
              isActive ? 'text-[var(--anchor-text)]' : 'text-[var(--anchor-text-muted)] group-hover:text-[var(--anchor-text)]'
            )}
          >
            {session.title}
          </span>
        </div>

        {/* Hover / Active Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={handleTogglePin}
            aria-label={session.pinned ? 'Unpin session' : 'Pin session'}
            className={cn(
              'p-1 rounded hover:bg-[var(--anchor-surface-active)] transition-colors',
              session.pinned ? 'opacity-100 text-[var(--anchor-warn)]' : 'text-[var(--anchor-text-subtle)]'
            )}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={handleDelete}
            aria-label="Delete session"
            className="p-1 rounded hover:bg-[var(--anchor-danger)]/20 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-danger)] transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <p className="text-[11px] text-[var(--anchor-text-subtle)] line-clamp-1 leading-normal pl-3.5">
        {session.preview || 'No messages yet'}
      </p>

      {/* Row metadata footer */}
      <div className="flex items-center justify-between text-[10px] text-[var(--anchor-text-subtle)] pl-3.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" size="xs">
            {session.modelId.replace('gemini-', 'g-').replace('claude-', 'c-')}
          </Badge>
          {isParent ? (
            <span title="Parent Source (Created on this device)" className="text-[var(--anchor-warn)]">
              <Laptop className="w-3 h-3" />
            </span>
          ) : (
            <span title="Replica session from peer device" className="text-[var(--anchor-info)]">
              <Cloud className="w-3 h-3" />
            </span>
          )}
        </div>
        <span className="font-mono">{formatRelativeDate(session.lastModified)}</span>
      </div>
    </div>
  );
};
