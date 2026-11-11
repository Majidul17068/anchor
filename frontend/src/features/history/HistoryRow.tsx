import React from 'react';
import type { Session } from '../../bridge/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { formatRelativeDate } from '../../lib/format';
import {
  Cloud,
  CloudOff,
  Copy,
  Download,
  ExternalLink,
  Laptop,
  Trash2,
} from 'lucide-react';

export interface HistoryRowProps {
  session: Session;
  isParent: boolean;
  onOpen: () => void;
  onResume: () => void;
  onExport: () => void;
  onDelete: () => void;
  onToggleSync: () => void;
}

export const HistoryRow: React.FC<HistoryRowProps> = ({
  session,
  isParent,
  onOpen,
  onResume,
  onExport,
  onDelete,
  onToggleSync,
}) => {
  return (
    <tr className="border-b border-[var(--anchor-border-subtle)] hover:bg-[var(--anchor-surface-hover)] transition-colors text-xs text-left group">
      {/* Session Title & Preview */}
      <td className="py-3 px-4 max-w-sm">
        <div className="flex flex-col">
          <span
            onClick={onOpen}
            className="font-semibold text-[var(--anchor-text)] hover:text-[var(--anchor-accent)] cursor-pointer truncate"
          >
            {session.title}
          </span>
          <span className="text-[11px] text-[var(--anchor-text-subtle)] line-clamp-1 mt-0.5">
            {session.preview || 'No messages'}
          </span>
        </div>
      </td>

      {/* Origin Device */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5">
          {isParent ? (
            <Badge variant="warn" size="xs">
              <Laptop className="w-3 h-3 mr-1" />
              This Device
            </Badge>
          ) : (
            <Badge variant="info" size="xs">
              <Cloud className="w-3 h-3 mr-1" />
              Replica
            </Badge>
          )}
        </div>
      </td>

      {/* Steps */}
      <td className="py-3 px-4 font-mono text-[var(--anchor-text-muted)]">
        {session.stepCount} steps
      </td>

      {/* Sync Status */}
      <td className="py-3 px-4">
        <Badge
          variant={
            session.syncState === 'conflict'
              ? 'danger'
              : session.syncState === 'published'
              ? 'ok'
              : session.syncState === 'replica'
              ? 'info'
              : 'default'
          }
          size="xs"
        >
          {session.syncState}
        </Badge>
      </td>

      {/* Last Modified */}
      <td className="py-3 px-4 text-[var(--anchor-text-subtle)] font-mono">
        {formatRelativeDate(session.lastModified)}
      </td>

      {/* Actions */}
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="xs"
            variant="ghost"
            title="Open in chat"
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={onOpen}
          />
          <Button
            size="xs"
            variant="ghost"
            title="Resume in new branch"
            icon={<Copy className="w-3.5 h-3.5" />}
            onClick={onResume}
          />
          <Button
            size="xs"
            variant="ghost"
            title="Export markdown"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={onExport}
          />
          {isParent && (
            <Button
              size="xs"
              variant="ghost"
              title={session.syncEnabled ? 'Unpublish from Drive' : 'Publish to Drive'}
              icon={session.syncEnabled ? <CloudOff className="w-3.5 h-3.5 text-[var(--anchor-warn)]" /> : <Cloud className="w-3.5 h-3.5" />}
              onClick={onToggleSync}
            />
          )}
          <Button
            size="xs"
            variant="ghost"
            title="Delete session"
            icon={<Trash2 className="w-3.5 h-3.5 text-[var(--anchor-danger)]" />}
            onClick={onDelete}
          />
        </div>
      </td>
    </tr>
  );
};
