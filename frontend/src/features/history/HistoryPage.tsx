import React, { useEffect, useState, useTransition } from 'react';
import type { Session, Device, Agent, Project } from '../../bridge/types';
import { getBridge } from '../../bridge';
import { useSessionStore } from '../../store/session';
import { useSyncStore } from '../../store/sync';
import { confirmDialog } from '../../store/confirm';
import { HistoryFilters } from './HistoryFilters';
import { HistoryRow } from './HistoryRow';
import { EmptyState } from '../../components/EmptyState';
import { Toast } from '../../components/Toast';

export interface HistoryPageProps {
  onOpenSession: (id: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onOpenSession }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [search, setSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedSync, setSelectedSync] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const thisDevice = useSyncStore((s) => s.thisDevice);
  const createSession = useSessionStore((s) => s.createSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const toggleSync = useSessionStore((s) => s.toggleSync);
  const exportMarkdown = useSessionStore((s) => s.exportMarkdown);

  const loadData = async () => {
    const bridge = getBridge();
    const [devs, ags, projs] = await Promise.all([
      bridge.devices.list(),
      bridge.agents.list(),
      bridge.projects.list(),
    ]);
    setDevices(devs);
    setAgents(ags);
    setProjects(projs);
  };

  const runSearch = async () => {
    const bridge = getBridge();
    const syncedBool = selectedSync === 'synced' ? true : selectedSync === 'local' ? false : undefined;
    const res = await bridge.history.search(search, {
      deviceId: selectedDevice || undefined,
      agentId: selectedAgent || undefined,
      projectId: selectedProject || undefined,
      synced: syncedBool,
    });
    setSessions(res);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    runSearch();
  }, [search, selectedDevice, selectedAgent, selectedProject, selectedSync]);

  const handleResume = async (s: Session) => {
    const newSess = await createSession({
      title: `Branch of ${s.title}`,
      agentId: s.agentId,
      modelId: s.modelId,
      effort: s.effort,
      mode: s.mode,
      workspacePaths: s.workspacePaths,
    });
    onOpenSession(newSess.id);
  };

  const handleExport = async (s: Session) => {
    const md = await exportMarkdown(s.id);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMessage(`Exported "${s.title}" as Markdown`);
  };

  const handleDelete = async (s: Session) => {
    const ok = await confirmDialog({
      title: `Delete session "${s.title}"?`,
      message: 'Removed from this device and from the Antigravity CLI.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      await deleteSession(s.id);
      await runSearch();
      setToastMessage(`Deleted "${s.title}"`);
    }
  };

  const handleToggleSync = async (s: Session) => {
    const success = await toggleSync(s.id);
    if (success) {
      await runSearch();
      setToastMessage(`Updated Google Drive sync for "${s.title}"`);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--anchor-bg)] overflow-hidden text-left">
      {/* Filters Bar */}
      <HistoryFilters
        searchQuery={search}
        onSearchChange={setSearch}
        selectedDevice={selectedDevice}
        onDeviceChange={setSelectedDevice}
        selectedAgent={selectedAgent}
        onAgentChange={setSelectedAgent}
        selectedProject={selectedProject}
        onProjectChange={setSelectedProject}
        selectedSync={selectedSync}
        onSyncChange={setSelectedSync}
        devices={devices}
        agents={agents}
        projects={projects}
      />

      {/* Main Table view */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-16 flex items-center justify-center">
            <EmptyState
              title="No Conversation History Found"
              description="No sessions match your filter criteria. Try clearing filters or creating a new chat session."
            />
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-[var(--anchor-surface-sunken)] border-b border-[var(--anchor-border)] text-[11px] font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)] sticky top-0 z-10 select-none">
              <tr>
                <th className="py-2.5 px-4 text-left">Session Title</th>
                <th className="py-2.5 px-4 text-left">Origin Device</th>
                <th className="py-2.5 px-4 text-left">Steps</th>
                <th className="py-2.5 px-4 text-left">Sync State</th>
                <th className="py-2.5 px-4 text-left">Last Modified</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <HistoryRow
                  key={s.id}
                  session={s}
                  isParent={s.originDeviceId === thisDevice?.id}
                  onOpen={() => onOpenSession(s.id)}
                  onResume={() => handleResume(s)}
                  onExport={() => handleExport(s)}
                  onDelete={() => handleDelete(s)}
                  onToggleSync={() => handleToggleSync(s)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          type="info"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};
