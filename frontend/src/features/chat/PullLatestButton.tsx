import React from 'react';
import { useSessionStore } from '../../store/session';
import { useSyncStore } from '../../store/sync';
import { useChatStore } from '../../store/chat';
import { Tooltip } from '../../components/Tooltip';
import { formatRelativeDate } from '../../lib/format';
import { RefreshCw } from 'lucide-react';

/**
 * "Pull latest" for a synced session: exchanges it with Google Drive right
 * now in both directions, then reloads the transcript. The parent merges
 * what other devices added; a replica downloads the parent's latest copy
 * and uploads its own additions. The 30 s background sync does the same
 * for every session, so this is for when you have just switched devices.
 */
export const PullLatestButton: React.FC = () => {
  const activeSession = useSessionStore((s) => s.activeSession);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const refreshSession = useSyncStore((s) => s.refreshSession);
  const pulling = useSyncStore((s) => s.pulling);
  const status = useSyncStore((s) => s.status);
  const loadSteps = useChatStore((s) => s.loadSteps);
  const isStreaming = useChatStore((s) => s.isStreaming);

  if (!activeSession) return null;
  const synced = activeSession.syncEnabled || activeSession.syncState === 'replica' || activeSession.syncState === 'conflict';
  if (!synced) return null;

  const busy = pulling === activeSession.id;
  const connected = Boolean(status?.driveConnected);
  const last = activeSession.lastSyncedAt ? `Last synced ${formatRelativeDate(activeSession.lastSyncedAt)}` : 'Not synced yet';

  const handleClick = async () => {
    if (busy || isStreaming) return;
    const id = activeSession.id;
    const s = await refreshSession(id);
    if (s) {
      await loadSessions();
      const current = useSessionStore.getState().sessions.find((x) => x.id === id);
      if (current) useSessionStore.setState({ activeSession: current });
      await loadSteps(id);
    }
  };

  return (
    <Tooltip
      side="bottom"
      content={connected ? `Pull latest from Google Drive · ${last}` : 'Connect Google Drive on the Sync page to pull'}
    >
      <button
        onClick={handleClick}
        disabled={busy || isStreaming || !connected}
        aria-label="Pull latest"
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-[11px] font-medium text-[var(--anchor-text-muted)] hover:text-[var(--anchor-text)] hover:bg-[var(--anchor-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${busy ? 'animate-spin text-[var(--anchor-accent)]' : ''}`} />
        <span className="hidden xl:inline">{busy ? 'Pulling…' : 'Pull latest'}</span>
      </button>
    </Tooltip>
  );
};
