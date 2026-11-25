import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useSettingsStore } from '../store/settings';
import { useMarketStore } from '../store/market';
import { useLearnStore } from '../store/learn';
import { useAutomationsStore } from '../store/automations';
import { useTheme } from '../hooks/useTheme';
import { confirmDialog } from '../store/confirm';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Tooltip } from '../components/Tooltip';
import {
  CalendarClock,
  Clock,
  Cpu,
  Layers,
  LogOut,
  MessageSquare,
  Moon,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sun,
  Terminal,
  UserRound,
} from 'lucide-react';
import { cn } from '../lib/cn';

export type RailTab = 'chat' | 'history' | 'agents' | 'skills' | 'market' | 'sync' | 'automations' | 'settings';

export interface RailProps {
  activeTab: RailTab;
  onSelectTab: (tab: RailTab) => void;
}

export const Rail: React.FC<RailProps> = ({ activeTab, onSelectTab }) => {
  const account = useAuthStore((s) => s.account);
  const logout = useAuthStore((s) => s.logout);
  const cliStatus = useSettingsStore((s) => s.cliStatus);
  const updatesCount = useMarketStore((s) => s.updatesAvailable.length);
  // Suggestions waiting for review ("Learn from my work") live in Settings.
  const learnDrafts = useLearnStore((s) => s.status?.drafts ?? 0);
  // Automations running right now show as a count on their icon.
  const automationsRunning = useAutomationsStore((s) => s.list.filter((a) => a.running).length);
  const { isDark, toggleTheme } = useTheme();

  // Account menu on the avatar: who is signed in, jump to Settings, sign out.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    const ok = await confirmDialog({
      title: 'Sign out of Google?',
      message: 'Anchor and the Antigravity CLI on this device forget the account. Your conversations stay on this device and on Google Drive; sign in again to continue.',
      confirmLabel: 'Sign out',
      danger: true,
    });
    if (ok) await logout();
  };

  const planLabel = account?.planName || (account?.plan === 'google_ai_pro' ? 'Google AI Pro' : account?.plan === 'google_ai_ultra' ? 'Google AI Ultra' : account?.plan === 'free' ? 'Free' : '');

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl+';

  const navItems: { id: RailTab; label: string; icon: React.ReactNode; shortcut: string; badge?: number }[] = [
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageSquare className="w-5 h-5" />,
      shortcut: `${modKey}1`,
    },
    {
      id: 'history',
      label: 'History',
      icon: <Clock className="w-5 h-5" />,
      shortcut: `${modKey}2`,
    },
    {
      id: 'agents',
      label: 'Agents',
      icon: <Cpu className="w-5 h-5" />,
      shortcut: `${modKey}3`,
    },
    {
      id: 'skills',
      label: 'Skills',
      icon: <Layers className="w-5 h-5" />,
      shortcut: `${modKey}4`,
    },
    {
      id: 'market',
      label: 'Anchor Marketplace',
      icon: <ShoppingBag className="w-5 h-5" />,
      shortcut: `${modKey}5`,
      badge: updatesCount > 0 ? updatesCount : undefined,
    },
    {
      id: 'sync',
      label: 'Sync & Devices',
      icon: <RefreshCw className="w-5 h-5" />,
      shortcut: `${modKey}6`,
    },
    {
      id: 'automations',
      label: 'Automations',
      icon: <CalendarClock className="w-5 h-5" />,
      shortcut: `${modKey}7`,
      badge: automationsRunning > 0 ? automationsRunning : undefined,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      shortcut: `${modKey}8`,
      badge: learnDrafts > 0 ? learnDrafts : undefined,
    },
  ];

  return (
    <nav
      aria-label="Navigation rail"
      className="w-14 bg-[var(--anchor-surface-sunken)] border-r border-[var(--anchor-border)] flex flex-col items-center justify-between py-3 select-none shrink-0 z-20"
    >
      {/* Top: Nav Icons */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <Tooltip
              key={item.id}
              side="right"
              content={
                <div className="flex items-center gap-2">
                  <span>{item.label}</span>
                  <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">{item.shortcut}</span>
                </div>
              }
            >
              <button
                onClick={() => onSelectTab(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer',
                  isActive
                    ? 'bg-[var(--anchor-accent)] text-white shadow-xs'
                    : 'text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] hover:bg-[var(--anchor-surface-hover)]'
                )}
              >
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--anchor-warn)] text-[9px] font-bold text-black flex items-center justify-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Bottom: CLI indicator, Theme toggle, Account Avatar */}
      <div className="flex flex-col items-center gap-3 w-full pt-3 border-t border-[var(--anchor-border-subtle)]">
        {/* Antigravity CLI status */}
        <Tooltip
          side="right"
          content={
            <div className="text-left text-[11px]">
              <div className="font-semibold text-[var(--anchor-text)]">Antigravity CLI (agy)</div>
              <div className="text-[var(--anchor-text-muted)] text-[10px]">
                {cliStatus?.installed ? `v${cliStatus.version}` : 'CLI Not Installed'}
              </div>
            </div>
          }
        >
          <div className="relative p-2 rounded-lg text-[var(--anchor-text-subtle)] hover:bg-[var(--anchor-surface-hover)] cursor-pointer">
            <Terminal className="w-4 h-4" />
            <span
              className={cn(
                'absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-[var(--anchor-surface-sunken)]',
                cliStatus?.installed ? 'bg-[var(--anchor-ok)]' : 'bg-[var(--anchor-danger)]'
              )}
            />
          </div>
        </Tooltip>

        {/* Theme Switcher */}
        <Tooltip side="right" content={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] hover:bg-[var(--anchor-surface-hover)] transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </Tooltip>

        {/* User Account: avatar opens a small menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn('rounded-full cursor-pointer ring-2 ring-transparent transition-shadow', menuOpen && 'ring-[var(--anchor-accent)]')}
          >
            <Avatar name={account?.name || 'Anchor User'} src={account?.avatarUrl} size="sm" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute left-12 bottom-0 w-64 rounded-xl border border-[var(--anchor-border)] bg-[var(--anchor-surface-elevated)] shadow-modal p-2 z-50 text-left animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar name={account?.name || 'Anchor User'} src={account?.avatarUrl} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--anchor-text)] truncate">{account?.name || 'Not signed in'}</div>
                  <div className="text-[11px] text-[var(--anchor-text-subtle)] font-mono truncate">{account?.email || 'Sign in from Settings'}</div>
                </div>
              </div>
              {planLabel && (
                <div className="px-2 pb-2">
                  <Badge variant="accent" size="xs">{planLabel}</Badge>
                </div>
              )}
              <div className="border-t border-[var(--anchor-border-subtle)] my-1" />
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSelectTab('settings');
                }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-[var(--anchor-text)] hover:bg-[var(--anchor-surface-hover)] cursor-pointer"
              >
                <UserRound className="w-4 h-4 text-[var(--anchor-text-subtle)]" /> Account &amp; settings
              </button>
              {account && (
                <button
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-[var(--anchor-danger)] hover:bg-[var(--anchor-surface-hover)] cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
