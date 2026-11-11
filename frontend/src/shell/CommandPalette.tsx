import React, { useEffect, useState, useMemo } from 'react';
import { useSessionStore } from '../store/session';
import { useAgentsStore } from '../store/agents';
import { useSkillsStore } from '../store/skills';
import { useMarketStore } from '../store/market';
import { useSettingsStore } from '../store/settings';
import {
  Clock,
  Cpu,
  Layers,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Sun,
  Terminal,
} from 'lucide-react';
import { Kbd } from '../components/Kbd';
import { cn } from '../lib/cn';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'chat' | 'history' | 'agents' | 'skills' | 'market' | 'sync' | 'settings') => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigateTab,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const sessions = useSessionStore((s) => s.sessions);
  const selectSession = useSessionStore((s) => s.selectSession);
  const createSession = useSessionStore((s) => s.createSession);
  const toggleSync = useSessionStore((s) => s.toggleSync);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);

  const agents = useAgentsStore((s) => s.agents);
  const selectAgent = useAgentsStore((s) => s.selectAgent);

  const skills = useSkillsStore((s) => s.skills);
  const selectSkill = useSkillsStore((s) => s.selectSkill);

  const listings = useMarketStore((s) => s.listings);
  const selectListing = useMarketStore((s) => s.selectListing);

  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const checkCli = useSettingsStore((s) => s.checkCli);

  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    const results: {
      id: string;
      title: string;
      subtitle?: string;
      category: 'Actions' | 'Sessions' | 'Agents' | 'Skills' | 'Marketplace' | 'Navigation';
      icon: React.ReactNode;
      onSelect: () => void;
    }[] = [];

    // Quick Actions
    if (!q || 'new session'.includes(q)) {
      results.push({
        id: 'action-new-session',
        title: 'New Session',
        subtitle: 'Create a fresh chat session with Antigravity CLI',
        category: 'Actions',
        icon: <Plus className="w-4 h-4 text-[var(--anchor-accent)]" />,
        onSelect: async () => {
          await createSession();
          onNavigateTab('chat');
        },
      });
    }

    if (!q || 'sync'.includes(q)) {
      if (currentSessionId) {
        results.push({
          id: 'action-toggle-sync',
          title: 'Toggle Session Sync',
          subtitle: 'Enable or disable Google Drive sync for active session',
          category: 'Actions',
          icon: <RefreshCw className="w-4 h-4 text-[var(--anchor-warn)]" />,
          onSelect: () => {
            toggleSync(currentSessionId);
          },
        });
      }
    }

    if (!q || 'theme'.includes(q) || 'dark'.includes(q) || 'light'.includes(q)) {
      results.push({
        id: 'action-toggle-theme',
        title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`,
        category: 'Actions',
        icon: theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />,
        onSelect: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark');
        },
      });
    }

    if (!q || 'cli'.includes(q) || 'version'.includes(q) || 'antigravity'.includes(q)) {
      results.push({
        id: 'action-check-cli',
        title: 'Check Antigravity CLI Status',
        subtitle: 'Verify agy binary and version daemon handshake',
        category: 'Actions',
        icon: <Terminal className="w-4 h-4 text-[var(--anchor-ok)]" />,
        onSelect: () => {
          checkCli();
          onNavigateTab('settings');
        },
      });
    }

    // Navigation sections
    const navs: { tab: 'chat' | 'history' | 'agents' | 'skills' | 'market' | 'sync' | 'settings'; label: string; icon: React.ReactNode }[] = [
      { tab: 'chat', label: 'Go to Chat', icon: <MessageSquare className="w-4 h-4" /> },
      { tab: 'history', label: 'Go to History', icon: <Clock className="w-4 h-4" /> },
      { tab: 'agents', label: 'Go to Agents Manager', icon: <Cpu className="w-4 h-4" /> },
      { tab: 'skills', label: 'Go to Skills Library', icon: <Layers className="w-4 h-4" /> },
      { tab: 'market', label: 'Go to Anchor Marketplace', icon: <ShoppingBag className="w-4 h-4" /> },
      { tab: 'sync', label: 'Go to Sync & Devices', icon: <RefreshCw className="w-4 h-4" /> },
      { tab: 'settings', label: 'Go to Settings', icon: <Settings className="w-4 h-4" /> },
    ];

    navs.forEach((n) => {
      if (!q || n.label.toLowerCase().includes(q)) {
        results.push({
          id: `nav-${n.tab}`,
          title: n.label,
          category: 'Navigation',
          icon: n.icon,
          onSelect: () => onNavigateTab(n.tab),
        });
      }
    });

    // Sessions
    sessions.forEach((s) => {
      if (!q || s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q)) {
        results.push({
          id: `sess-${s.id}`,
          title: s.title,
          subtitle: s.preview,
          category: 'Sessions',
          icon: <MessageSquare className="w-4 h-4 text-[var(--anchor-accent)]" />,
          onSelect: async () => {
            await selectSession(s.id);
            onNavigateTab('chat');
          },
        });
      }
    });

    // Agents
    agents.forEach((ag) => {
      if (!q || ag.name.toLowerCase().includes(q) || ag.description.toLowerCase().includes(q)) {
        results.push({
          id: `agent-${ag.id}`,
          title: ag.name,
          subtitle: ag.description,
          category: 'Agents',
          icon: <Cpu className="w-4 h-4 text-purple-400" />,
          onSelect: async () => {
            await selectAgent(ag.id);
            onNavigateTab('agents');
          },
        });
      }
    });

    // Skills
    skills.forEach((sk) => {
      if (!q || sk.name.toLowerCase().includes(q) || sk.description.toLowerCase().includes(q)) {
        results.push({
          id: `skill-${sk.id}`,
          title: sk.name,
          subtitle: sk.description,
          category: 'Skills',
          icon: <Layers className="w-4 h-4 text-[var(--anchor-info)]" />,
          onSelect: async () => {
            await selectSkill(sk.id);
            onNavigateTab('skills');
          },
        });
      }
    });

    // Marketplace
    listings.forEach((l) => {
      if (!q || l.name.toLowerCase().includes(q) || l.tagline.toLowerCase().includes(q)) {
        results.push({
          id: `market-${l.id}`,
          title: l.name,
          subtitle: l.tagline,
          category: 'Marketplace',
          icon: <ShoppingBag className="w-4 h-4 text-[var(--anchor-warn)]" />,
          onSelect: async () => {
            await selectListing(l.id);
            onNavigateTab('market');
          },
        });
      }
    });

    return results.slice(0, 30);
  }, [query, sessions, agents, skills, listings, theme, currentSessionId]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 0, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].onSelect();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, items, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] rounded-xl shadow-modal overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--anchor-border)] bg-[var(--anchor-surface)]">
          <Search className="w-4 h-4 text-[var(--anchor-text-subtle)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, sessions, skills, agents..."
            className="w-full bg-transparent text-sm text-[var(--anchor-text)] placeholder-[var(--anchor-text-subtle)] focus:outline-none"
          />
          <div className="flex items-center gap-1 shrink-0">
            <Kbd>ESC</Kbd>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-[var(--anchor-border-subtle)] text-left">
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--anchor-text-muted)]">
              No matching commands or entities found for &quot;{query}&quot;
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs gap-3',
                    isSelected
                      ? 'bg-[var(--anchor-surface-active)] text-[var(--anchor-text)]'
                      : 'text-[var(--anchor-text-muted)] hover:bg-[var(--anchor-surface-hover)]'
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="flex flex-col truncate">
                      <span className="font-medium text-[var(--anchor-text)] truncate">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="text-[11px] text-[var(--anchor-text-subtle)] truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--anchor-text-subtle)] px-1.5 py-0.5 rounded bg-[var(--anchor-surface)] shrink-0">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-[var(--anchor-surface-sunken)] border-t border-[var(--anchor-border)] flex items-center justify-between text-[11px] text-[var(--anchor-text-subtle)]">
          <div className="flex items-center gap-3">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate
            </span>
            <span>
              <Kbd>↵</Kbd> to select
            </span>
          </div>
          <span className="font-mono text-[10px]">Anchor Universal Jump</span>
        </div>
      </div>
    </div>
  );
};
