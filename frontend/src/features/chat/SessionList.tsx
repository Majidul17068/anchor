import React, { useState } from 'react';
import { useSessionStore } from '../../store/session';
import { useSyncStore } from '../../store/sync';
import { useAgentsStore } from '../../store/agents';
import { SessionRow } from './SessionRow';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Dialog } from '../../components/Dialog';
import { Select } from '../../components/Select';
import {
  Folder,
  Plus,
  Search,
  Pin,
  Laptop,
  Cloud,
  FileQuestion,
} from 'lucide-react';
import { getBridge } from '../../bridge';

export const SessionList: React.FC = () => {
  const sessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const selectSession = useSessionStore((s) => s.selectSession);
  const createSession = useSessionStore((s) => s.createSession);
  const thisDevice = useSyncStore((s) => s.thisDevice);
  const agents = useAgentsStore((s) => s.agents);

  const [search, setSearch] = useState('');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAgentId, setNewAgentId] = useState('agent_general');
  const [newFolder, setNewFolder] = useState('/Users/majidul/dev/anchor');

  const filteredSessions = sessions.filter((s) => {
    if (!search.trim()) return true;
    return s.title.toLowerCase().includes(search.toLowerCase());
  });

  const pinnedSessions = filteredSessions.filter((s) => s.pinned);
  const thisDeviceSessions = filteredSessions.filter(
    (s) => !s.pinned && s.originDeviceId === thisDevice?.id && s.syncEnabled
  );
  const replicaSessions = filteredSessions.filter(
    (s) => !s.pinned && s.originDeviceId !== thisDevice?.id && s.syncEnabled
  );
  const localOnlySessions = filteredSessions.filter((s) => !s.pinned && !s.syncEnabled);

  const handlePickFolder = async () => {
    const bridge = getBridge();
    const folder = await bridge.system.pickFolder();
    if (folder) setNewFolder(folder);
  };

  const handleCreate = async () => {
    await createSession({
      title: newTitle.trim() || 'New Session',
      agentId: newAgentId,
      workspacePaths: [newFolder],
    });
    setNewTitle('');
    setNewDialogOpen(false);
  };

  return (
    <div className="flex flex-col h-full w-full select-none text-left">
      {/* Top action bar: Search & New Session */}
      <div className="p-3 border-b border-[var(--anchor-border)] space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
            Sessions
          </span>
          <Button
            size="xs"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setNewDialogOpen(true)}
          >
            New Session
          </Button>
        </div>
        <Input
          placeholder="Filter sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="w-3.5 h-3.5" />}
          className="text-xs py-1.5"
        />
      </div>

      {/* Grouped session scroll area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Pinned Section */}
        {pinnedSessions.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-[var(--anchor-warn)]">
              <Pin className="w-3 h-3" />
              <span>Pinned</span>
            </div>
            {pinnedSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                isActive={s.id === currentSessionId}
                thisDeviceId={thisDevice?.id}
                onSelect={() => selectSession(s.id)}
              />
            ))}
          </div>
        )}

        {/* This device (Parent Source) */}
        {thisDeviceSessions.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-[var(--anchor-text-muted)]">
              <Laptop className="w-3 h-3 text-[var(--anchor-warn)]" />
              <span>This Device (Parent Source)</span>
              <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono ml-auto">
                {thisDeviceSessions.length}
              </span>
            </div>
            {thisDeviceSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                isActive={s.id === currentSessionId}
                thisDeviceId={thisDevice?.id}
                onSelect={() => selectSession(s.id)}
              />
            ))}
          </div>
        )}

        {/* Synced from other devices */}
        {replicaSessions.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-[var(--anchor-text-muted)]">
              <Cloud className="w-3 h-3 text-[var(--anchor-info)]" />
              <span>Synced from Other Devices</span>
              <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono ml-auto">
                {replicaSessions.length}
              </span>
            </div>
            {replicaSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                isActive={s.id === currentSessionId}
                thisDeviceId={thisDevice?.id}
                onSelect={() => selectSession(s.id)}
              />
            ))}
          </div>
        )}

        {/* Not synced / Local only */}
        {localOnlySessions.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-[var(--anchor-text-subtle)]">
              <FileQuestion className="w-3 h-3" />
              <span>Not Synced (Local)</span>
              <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono ml-auto">
                {localOnlySessions.length}
              </span>
            </div>
            {localOnlySessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                isActive={s.id === currentSessionId}
                thisDeviceId={thisDevice?.id}
                onSelect={() => selectSession(s.id)}
              />
            ))}
          </div>
        )}

        {filteredSessions.length === 0 && (
          <div className="p-6 text-center text-xs text-[var(--anchor-text-subtle)]">
            No matching sessions found.
          </div>
        )}
      </div>

      {/* New Session Dialog */}
      <Dialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        title="Start New Antigravity Session"
        description="Initialize a new session driven by Antigravity CLI and anchored to this device."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreate}>
              Create Session
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Session Title"
            placeholder="e.g. Refactor API endpoints"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />

          <Select
            label="Assigned Agent"
            value={newAgentId}
            onChange={(e) => setNewAgentId(e.target.value)}
            options={agents.map((ag) => ({
              value: ag.id,
              label: `${ag.name} (${ag.source})`,
            }))}
          />

          <div>
            <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1">
              Workspace Folder
            </label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={newFolder}
                className="font-mono text-xs"
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<Folder className="w-3.5 h-3.5" />}
                onClick={handlePickFolder}
              >
                Browse
              </Button>
            </div>
            <span className="text-[11px] text-[var(--anchor-text-subtle)] mt-1 block">
              CLI daemon operations will be scoped to this project directory.
            </span>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
