import React, { useState, useEffect } from 'react';
import { TitleBar } from './shell/TitleBar';
import { Rail, type RailTab } from './shell/Rail';
import { Inspector } from './shell/Inspector';
import { CommandPalette } from './shell/CommandPalette';
import { ChatPage } from './features/chat/ChatPage';
import { HistoryPage } from './features/history/HistoryPage';
import { AgentsPage } from './features/agents/AgentsPage';
import { SkillsPage } from './features/skills/SkillsPage';
import { MarketPage } from './features/market/MarketPage';
import { SyncPage } from './features/sync/SyncPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { Onboarding } from './features/onboarding/Onboarding';
import { ConfirmHost } from './components/ConfirmDialog';
import { useSessionStore } from './store/session';
import { useChatStore } from './store/chat';
import { useAuthStore } from './store/auth';
import { useSettingsStore } from './store/settings';
import { useSyncStore } from './store/sync';
import { useShortcut } from './hooks/useShortcut';

export default function App() {
  const [activeTab, setActiveTab] = useState<RailTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anchor.rail') as RailTab;
      if (['chat', 'history', 'agents', 'skills', 'market', 'sync', 'settings'].includes(saved)) {
        return saved;
      }
    }
    return 'chat';
  });

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const loadSessions = useSessionStore((s) => s.loadSessions);
  const createSession = useSessionStore((s) => s.createSession);
  const toggleSync = useSessionStore((s) => s.toggleSync);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const selectSession = useSessionStore((s) => s.selectSession);

  const isStreaming = useChatStore((s) => s.isStreaming);
  const stopStreaming = useChatStore((s) => s.stopStreaming);

  const checkStatus = useAuthStore((s) => s.checkStatus);
  const account = useAuthStore((s) => s.account);
  const authLoading = useAuthStore((s) => s.loading);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const cliStatus = useSettingsStore((s) => s.cliStatus);
  const loadSyncState = useSyncStore((s) => s.loadSyncState);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Initialize all stores, then decide whether onboarding is needed: a
  // machine without the Antigravity CLI or without a signed-in Google
  // account always starts on the welcome screen.
  useEffect(() => {
    (async () => {
      await Promise.all([loadSettings(), checkStatus(), loadSyncState()]);
      const params = new URLSearchParams(window.location.search);
      const cli = useSettingsStore.getState().cliStatus;
      const acc = useAuthStore.getState().account;
      if (params.get('onboarding') === '1' || !cli?.installed || !acc) {
        setShowOnboarding(true);
      } else {
        loadSessions();
      }
      setBootstrapped(true);
    })();
  }, [loadSettings, checkStatus, loadSessions, loadSyncState]);

  // The desktop shell announces session changes (title updates from the
  // CLI, turns finishing, Drive sync pulls); refresh the list and the
  // active session without disturbing an in-flight stream.
  useEffect(() => {
    const off = window.runtime?.EventsOn('sessions:changed', async () => {
      await loadSessions();
      const { currentSessionId, sessions } = useSessionStore.getState();
      const current = sessions.find((s) => s.id === currentSessionId);
      if (current) {
        useSessionStore.setState({ activeSession: current });
        document.title = `Anchor — ${current.title}`;
      }
    });
    return () => off?.();
  }, [loadSessions]);

  // Signing out must land on the sign-in screen rather than leave the shell
  // up with an empty account: the decision was only taken at bootstrap.
  useEffect(() => {
    if (bootstrapped && !authLoading && !account) {
      setShowOnboarding(true);
    }
  }, [bootstrapped, authLoading, account]);

  const finishOnboarding = () => {
    setShowOnboarding(false);
    loadSessions();
  };

  const closeInspector = useChatStore((s) => s.closeInspector);

  const handleSelectTab = (tab: RailTab) => {
    setActiveTab(tab);
    if (tab !== 'chat') {
      closeInspector();
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('anchor.rail', tab);
    }
  };

  // Keyboard Shortcuts
  // Cmd/Ctrl+K: Command Palette
  useShortcut('k', () => setCommandPaletteOpen((prev) => !prev), { ctrlOrMeta: true });

  // Cmd/Ctrl+N: New Session
  useShortcut(
    'n',
    async () => {
      await createSession();
      handleSelectTab('chat');
    },
    { ctrlOrMeta: true }
  );

  // Cmd/Ctrl+1..7: Rail view switches
  useShortcut('1', () => handleSelectTab('chat'), { ctrlOrMeta: true });
  useShortcut('2', () => handleSelectTab('history'), { ctrlOrMeta: true });
  useShortcut('3', () => handleSelectTab('agents'), { ctrlOrMeta: true });
  useShortcut('4', () => handleSelectTab('skills'), { ctrlOrMeta: true });
  useShortcut('5', () => handleSelectTab('market'), { ctrlOrMeta: true });
  useShortcut('6', () => handleSelectTab('sync'), { ctrlOrMeta: true });
  useShortcut('7', () => handleSelectTab('settings'), { ctrlOrMeta: true });

  // Cmd/Ctrl+Shift+S: Toggle Sync (parent only)
  useShortcut(
    's',
    () => {
      if (currentSessionId) {
        toggleSync(currentSessionId);
      }
    },
    { ctrlOrMeta: true, shift: true }
  );

  // Esc: Stop streaming if streaming
  useShortcut('Escape', () => {
    if (isStreaming && currentSessionId) {
      stopStreaming(currentSessionId);
    }
  });

  if (!bootstrapped && (authLoading || (!account && !cliStatus))) {
    return <div className="h-screen w-screen bg-[var(--anchor-bg)]" aria-busy="true" />;
  }

  if (showOnboarding) {
    return (
      <>
        <Onboarding onFinish={finishOnboarding} />
        <ConfirmHost />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--anchor-bg)] text-[var(--anchor-text)] min-w-[1024px]">
      <ConfirmHost />
      {/* Native Desktop Window TitleBar */}
      <TitleBar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

      {/* Main 3-Column Desktop Shell */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Vertical Rail */}
        <Rail activeTab={activeTab} onSelectTab={handleSelectTab} />

        {/* Center Main Feature Pane */}
        <main role="main" className="flex-1 flex overflow-hidden relative">
          {activeTab === 'chat' && <ChatPage />}
          {activeTab === 'history' && (
            <HistoryPage
              onOpenSession={(id) => {
                selectSession(id);
                handleSelectTab('chat');
              }}
            />
          )}
          {activeTab === 'agents' && <AgentsPage />}
          {activeTab === 'skills' && <SkillsPage />}
          {activeTab === 'market' && <MarketPage />}
          {activeTab === 'sync' && <SyncPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>

        {/* Right Slide-in Inspector */}
        <Inspector />
      </div>

      {/* Global Universal Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigateTab={handleSelectTab}
      />
    </div>
  );
}
