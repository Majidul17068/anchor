import React from 'react';
import { Kbd } from '../../components/Kbd';
import { Keyboard } from 'lucide-react';

export const ShortcutsSection: React.FC = () => {
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { key: `${modKey} + N`, desc: 'Create new chat session with Antigravity CLI' },
    { key: `${modKey} + K`, desc: 'Open Universal Command Palette & Jump' },
    { key: `${modKey} + 1`, desc: 'Switch rail view to Chat' },
    { key: `${modKey} + 2`, desc: 'Switch rail view to History' },
    { key: `${modKey} + 3`, desc: 'Switch rail view to Agents Manager' },
    { key: `${modKey} + 4`, desc: 'Switch rail view to Skills Library' },
    { key: `${modKey} + 5`, desc: 'Switch rail view to Anchor Marketplace' },
    { key: `${modKey} + 6`, desc: 'Switch rail view to Sync & Devices' },
    { key: `${modKey} + 7`, desc: 'Switch rail view to Settings' },
    { key: `${modKey} + Shift + S`, desc: 'Toggle Google Drive sync (Parent source only)' },
    { key: 'Esc', desc: 'Stop active model streaming / Close modal overlays' },
    { key: 'Enter', desc: 'Send prompt in composer' },
    { key: 'Shift + Enter', desc: 'Insert newline in multiline composer' },
  ];

  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--anchor-border-subtle)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-accent)]">
          <Keyboard className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--anchor-text)]">
            Desktop Keyboard Shortcuts
          </h3>
          <p className="text-xs text-[var(--anchor-text-muted)]">
            High-efficiency navigation keybindings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {shortcuts.map((sc, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border-subtle)]"
          >
            <span className="text-[var(--anchor-text)] font-medium text-[11px] truncate pr-2">
              {sc.desc}
            </span>
            <Kbd className="font-mono text-xs">{sc.key}</Kbd>
          </div>
        ))}
      </div>
    </div>
  );
};
