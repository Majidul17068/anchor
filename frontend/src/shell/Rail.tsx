import React from 'react';
import { useAuthStore } from '../store/auth';
import { useSettingsStore } from '../store/settings';
import { useMarketStore } from '../store/market';
import { useTheme } from '../hooks/useTheme';
import { Avatar } from '../components/Avatar';
import { Tooltip } from '../components/Tooltip';
import {
  Clock,
  Cpu,
  Layers,
  MessageSquare,
  Moon,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sun,
  Terminal,
} from 'lucide-react';
import { cn } from '../lib/cn';

export type RailTab = 'chat' | 'history' | 'agents' | 'skills' | 'market' | 'sync' | 'settings';

export interface RailProps {
  activeTab: RailTab;
  onSelectTab: (tab: RailTab) => void;
}

export const Rail: React.FC<RailProps> = ({ activeTab, onSelectTab }) => {
  const account = useAuthStore((s) => s.account);
  const cliStatus = useSettingsStore((s) => s.cliStatus);
  const updatesCount = useMarketStore((s) => s.updatesAvailable.length);
  const { isDark, toggleTheme } = useTheme();

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
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      shortcut: `${modKey}7`,
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

        {/* User Account */}
        <Tooltip
          side="right"
          content={
            <div className="text-left text-[11px]">
              <div className="font-semibold text-[var(--anchor-text)]">{account?.name || 'Guest'}</div>
              <div className="text-[10px] text-[var(--anchor-text-muted)]">{account?.email}</div>
            </div>
          }
        >
          <div className="cursor-pointer">
            <Avatar
              name={account?.name || 'Anchor User'}
              src={account?.avatarUrl}
              size="sm"
            />
          </div>
        </Tooltip>
      </div>
    </nav>
  );
};
