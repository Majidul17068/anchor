import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../../store/session';
import { useChatStore } from '../../store/chat';
import { useSyncStore } from '../../store/sync';
import { SessionList } from './SessionList';
import { Transcript } from './Transcript';
import { Composer } from './Composer';
import { ModelPicker } from './ModelPicker';
import { AgentPicker } from './AgentPicker';
import { EffortPicker } from './EffortPicker';
import { ModePicker } from './ModePicker';
import { SyncToggle } from './SyncToggle';
import { Toast } from '../../components/Toast';
import { Badge } from '../../components/Badge';
import { Folder, Laptop, Cloud, Edit2, Check } from 'lucide-react';

export const ChatPage: React.FC = () => {
  const activeSession = useSessionStore((s) => s.activeSession);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const updateSession = useSessionStore((s) => s.updateSession);
  const errorMessage = useSessionStore((s) => s.errorMessage);
  const clearError = useSessionStore((s) => s.clearError);

  const steps = useChatStore((s) => s.steps);
  const loadSteps = useChatStore((s) => s.loadSteps);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const thisDevice = useSyncStore((s) => s.thisDevice);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  useEffect(() => {
    if (currentSessionId) {
      loadSteps(currentSessionId);
    }
  }, [currentSessionId, loadSteps]);

  useEffect(() => {
    if (activeSession) {
      setEditedTitle(activeSession.title);
    }
  }, [activeSession]);

  const handleSaveTitle = async () => {
    if (activeSession && editedTitle.trim()) {
      await updateSession(activeSession.id, { title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const isParent = activeSession && thisDevice ? activeSession.originDeviceId === thisDevice.id : true;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Context Sidebar: Session List */}
      <div className="w-80 h-full border-r border-[var(--anchor-border)] bg-[var(--anchor-surface)] shrink-0">
        <SessionList />
      </div>

      {/* Main chat column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--anchor-bg)]">
        {activeSession ? (
          <>
            {/* Header controls bar */}
            <div className="h-12 px-3 border-b border-[var(--anchor-border)] bg-[var(--anchor-surface)] flex items-center justify-between gap-2 shrink-0 select-none">
              {/* Left: Editable session title & workspace chip */}
              <div className="flex items-center gap-2 min-w-0 shrink">
                {isEditingTitle ? (
                  <div className="flex items-center gap-1 min-w-0">
                    <input
                      autoFocus
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') setIsEditingTitle(false);
                      }}
                      className="text-xs font-semibold px-2 py-0.5 bg-[var(--anchor-surface-sunken)] text-[var(--anchor-text)] border border-[var(--anchor-border-focus)] rounded min-w-[140px]"
                    />
                    <button
                      onClick={handleSaveTitle}
                      className="p-1 text-[var(--anchor-ok)] hover:bg-[var(--anchor-surface-hover)] rounded shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingTitle(true)}
                    className="flex items-center gap-1.5 cursor-pointer group min-w-0 shrink"
                  >
                    <h2 className="text-xs font-semibold text-[var(--anchor-text)] truncate max-w-[180px] sm:max-w-[240px]">
                      {activeSession.title}
                    </h2>
                    <Edit2 className="w-3 h-3 text-[var(--anchor-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                )}

                {/* Origin device badge */}
                <Badge
                  variant={isParent ? 'warn' : 'info'}
                  size="xs"
                  className="hidden md:inline-flex"
                >
                  {isParent ? (
                    <>
                      <Laptop className="w-3 h-3 mr-1" />
                      Parent Source
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3 h-3 mr-1" />
                      Replica
                    </>
                  )}
                </Badge>

                {/* Workspace Folder chip */}
                {activeSession.workspacePaths[0] && (
                  <div
                    title={activeSession.workspacePaths[0]}
                    className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-[10px] text-[var(--anchor-text-subtle)] font-mono truncate max-w-[150px]"
                  >
                    <Folder className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {activeSession.workspacePaths[0].split('/').pop() || 'workspace'}
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Agent, Model, Effort, Mode, and Sync Toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <AgentPicker />
                <ModelPicker />
                <EffortPicker />
                <ModePicker />
                <SyncToggle />
              </div>
            </div>

            {/* Transcript Area */}
            <Transcript
              sessionId={activeSession.id}
              steps={steps}
              isStreaming={isStreaming}
            />

            {/* Composer */}
            <Composer sessionId={activeSession.id} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--anchor-text-subtle)]">
            No active session selected.
          </div>
        )}
      </div>

      {/* Floating error toast */}
      {errorMessage && (
        <Toast
          message={errorMessage}
          type="error"
          onClose={clearError}
        />
      )}
    </div>
  );
};
