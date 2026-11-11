import React, { useState } from 'react';
import type { Device } from '../../bridge/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { formatRelativeDate } from '../../lib/format';
import { Edit2, Check, Laptop, Monitor, Terminal } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface DeviceCardProps {
  device: Device;
  sessionCount: number;
  onRename?: (name: string) => Promise<void>;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  sessionCount,
  onRename,
}) => {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(device.name);

  const handleSave = async () => {
    if (onRename && nameInput.trim()) {
      await onRename(nameInput.trim());
    }
    setEditing(false);
  };

  const getPlatformIcon = () => {
    if (device.platform === 'win32') return <Monitor className="w-4 h-4" />;
    if (device.platform === 'linux') return <Terminal className="w-4 h-4" />;
    return <Laptop className="w-4 h-4" />;
  };

  return (
    <div
      className={cn(
        'p-4 rounded-xl border bg-[var(--anchor-surface)] text-left space-y-3 shadow-xs',
        device.isThisDevice
          ? 'border-[var(--anchor-warn)]/50 ring-1 ring-[var(--anchor-warn)]/30'
          : 'border-[var(--anchor-border)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border',
              device.isThisDevice
                ? 'bg-[var(--anchor-warn-subtle)] text-[var(--anchor-warn)] border-[var(--anchor-warn)]/30'
                : 'bg-[var(--anchor-surface-sunken)] text-[var(--anchor-text-subtle)] border-[var(--anchor-border)]'
            )}
          >
            {getPlatformIcon()}
          </div>

          <div className="min-w-0">
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--anchor-surface-sunken)] text-[var(--anchor-text)] border border-[var(--anchor-border-focus)]"
                />
                <button
                  onClick={handleSave}
                  className="p-1 text-[var(--anchor-ok)] hover:bg-[var(--anchor-surface-hover)] rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group">
                <h4 className="text-sm font-semibold text-[var(--anchor-text)] truncate">
                  {device.name}
                </h4>
                {device.isThisDevice && onRename && (
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
            <span className="text-[11px] text-[var(--anchor-text-subtle)] font-mono block">
              ID: {device.id} • {device.platform}
            </span>
          </div>
        </div>

        <Badge variant={device.isThisDevice ? 'warn' : 'default'} size="xs">
          {device.isThisDevice ? 'Parent Source (This Device)' : 'Replica Device'}
        </Badge>
      </div>

      <div className="pt-2 border-t border-[var(--anchor-border-subtle)] flex items-center justify-between text-[11px] text-[var(--anchor-text-subtle)]">
        <div>
          Parent source of <strong className="text-[var(--anchor-text)]">{sessionCount}</strong> sessions
        </div>
        <div className="font-mono">
          {device.isThisDevice ? 'Active Now' : `Last seen ${formatRelativeDate(device.lastSeen)}`}
        </div>
      </div>
    </div>
  );
};
