import React from 'react';
import { useSessionStore } from '../store/session';
import { useSyncStore } from '../store/sync';
import { useAuthStore } from '../store/auth';
import { AnchorGlyph } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { Cloud, CloudOff, Laptop, Search } from 'lucide-react';
import { Kbd } from '../components/Kbd';

export interface TitleBarProps {
  onOpenCommandPalette: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenCommandPalette }) => {
  const activeSession = useSessionStore((s) => s.activeSession);
  const syncStatus = useSyncStore((s) => s.status);
  const thisDevice = useSyncStore((s) => s.thisDevice);
  const account = useAuthStore((s) => s.account);

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  // Inside the desktop shell the OS draws real window controls (macOS
  // traffic lights overlay the top-left), so the decorative ones are hidden
  // and the bar becomes a drag region.
  const isDesktop = typeof document !== 'undefined' && document.documentElement.dataset.shell === 'desktop';
  const version = `v${__APP_VERSION__}`;

  return (
    <header
      role="banner"
      style={{ ['--wails-draggable' as string]: 'drag' }}
      className={`h-10 w-full bg-[var(--anchor-surface-sunken)] border-b border-[var(--anchor-border)] flex items-center justify-between px-3 select-none z-30 shrink-0 text-xs ${
        isDesktop && isMac ? 'pl-[78px]' : ''
      }`}
    >
      {/* Left: Window controls placeholder & Brand */}
      <div className="flex items-center gap-3">
        {!isDesktop && (
          <div className="flex items-center gap-1.5 pr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors cursor-pointer" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors cursor-pointer" />
          </div>
        )}

        <div className={`flex items-center gap-2 pl-1 ${isDesktop ? '' : 'border-l border-[var(--anchor-border)]'}`}>
          <AnchorGlyph size={16} />
          <span className="font-semibold text-[var(--anchor-text)] tracking-tight">Anchor</span>
          <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">{version}</span>
        </div>
      </div>

      {/* Middle: Current Session Title & Command Palette launcher */}
      <div className="flex items-center gap-2 max-w-md">
        <button
          style={{ ['--wails-draggable' as string]: 'no-drag' }}
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--anchor-surface)] hover:bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] text-[var(--anchor-text-muted)] hover:text-[var(--anchor-text)] transition-all cursor-pointer shadow-xs"
        >
          <Search className="w-3.5 h-3.5 text-[var(--anchor-text-subtle)]" />
          <span className="truncate max-w-[220px]">
            {activeSession ? activeSession.title : 'Jump to session, agent, skill...'}
          </span>
          <div className="flex items-center gap-1 pl-2 border-l border-[var(--anchor-border)]">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </div>
        </button>
      </div>

      {/* Right: Device & Drive Sync Indicator */}
      <div className="flex items-center gap-3 text-[11px]">
        {thisDevice && (
          <div className="flex items-center gap-1.5 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text-muted)]">
            <Laptop className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-mono">{thisDevice.name}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--anchor-border)]">
          {syncStatus?.driveConnected ? (
            <div className="flex items-center gap-1 text-[var(--anchor-ok)]" title="Drive sync connected">
              <Cloud className="w-3.5 h-3.5" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--anchor-ok)]" />
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[var(--anchor-text-subtle)]" title="Drive sync offline">
              <CloudOff className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {account && (
          <Badge
            variant={account.plan === 'google_ai_pro' ? 'accent' : 'default'}
            size="xs"
            className="font-mono uppercase tracking-wider"
          >
            {account.plan === 'google_ai_pro' ? 'AI Pro' : account.plan}
          </Badge>
        )}
      </div>
    </header>
  );
};
