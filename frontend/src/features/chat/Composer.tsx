import React, { useState, useRef, useEffect } from 'react';
import type { Attachment } from '../../bridge/types';
import { useChatStore } from '../../store/chat';
import { useSessionStore } from '../../store/session';
import { getBridge } from '../../bridge';
import { Button } from '../../components/Button';
import { Kbd } from '../../components/Kbd';
import {
  CornerDownLeft,
  Paperclip,
  Square,
  X,
  FileText,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ComposerProps {
  sessionId: string;
}

export const Composer: React.FC<ComposerProps> = ({ sessionId }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');

  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);
  const activeSession = useSessionStore((s) => s.activeSession);
  const steps = useChatStore((s) => s.steps);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const slashCommands = [
    { cmd: '/model', desc: 'Switch model (Gemini 4 Argon, Claude Opus...)' },
    { cmd: '/agent', desc: 'Assign agent persona' },
    { cmd: '/skill', desc: 'Invoke specific skill into conversation' },
    { cmd: '/clear', desc: 'Clear conversation transcript' },
    { cmd: '/sync', desc: 'Check or trigger Google Drive synchronization' },
  ];

  const filteredCommands = slashCommands.filter((c) =>
    c.cmd.toLowerCase().startsWith(slashFilter.toLowerCase())
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(val);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectSlash = (cmd: string) => {
    if (cmd === '/clear') {
      setText('');
      setShowSlashMenu(false);
      return;
    }
    setText(cmd + ' ');
    setShowSlashMenu(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      if (isStreaming) {
        stopStreaming(sessionId);
      }
      setShowSlashMenu(false);
    }
  };

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isStreaming) return;
    sendMessage(sessionId, text.trim(), attachments);
    setText('');
    setAttachments([]);
    setShowSlashMenu(false);
  };

  const handlePickAttachments = async () => {
    const bridge = getBridge();
    const files = await bridge.system.pickFiles();
    if (files && files.length > 0) {
      setAttachments((prev) => [...prev, ...files]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="relative p-3 bg-[var(--anchor-surface-sunken)] border-t border-[var(--anchor-border)] text-left shrink-0">
      {/* Slash command autocomplete overlay */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 w-80 bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] rounded-xl shadow-modal overflow-hidden p-1 z-30 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[var(--anchor-text-subtle)] border-b border-[var(--anchor-border-subtle)]">
            Slash Commands
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-[var(--anchor-border-subtle)]">
            {filteredCommands.map((c) => (
              <div
                key={c.cmd}
                onClick={() => handleSelectSlash(c.cmd)}
                className="flex flex-col px-3 py-1.5 hover:bg-[var(--anchor-surface-hover)] cursor-pointer text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-[var(--anchor-accent)]">
                    {c.cmd}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--anchor-text-subtle)]">
                  {c.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments preview pill row */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--anchor-surface)] border border-[var(--anchor-border)] text-xs text-[var(--anchor-text)] shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--anchor-text-subtle)]" />
              <span className="truncate max-w-[140px] font-medium">{att.name}</span>
              <button
                onClick={() => removeAttachment(i)}
                aria-label={`Remove attachment ${att.name}`}
                className="text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-danger)] p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input container */}
      <div className="relative bg-[var(--anchor-surface)] border border-[var(--anchor-border)] focus-within:border-[var(--anchor-border-focus)] rounded-xl p-2.5 transition-all shadow-xs">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask Antigravity agent or type '/' for commands..."
          rows={1}
          className="w-full bg-transparent text-sm text-[var(--anchor-text)] placeholder-[var(--anchor-text-subtle)] resize-none focus:outline-none min-h-[44px] max-h-[180px] leading-relaxed"
        />

        {/* Action bar beneath textarea */}
        <div className="flex items-center justify-between pt-1 select-none text-xs text-[var(--anchor-text-subtle)]">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePickAttachments}
              aria-label="Attach file"
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--anchor-surface-hover)] text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] transition-colors cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="text-[11px]">Attach</span>
            </button>

            <span className="text-[11px] font-mono pl-1 border-l border-[var(--anchor-border)]">
              {steps.length} steps
            </span>

            {activeSession && (
              <span className="text-[11px] font-mono text-[var(--anchor-text-subtle)] hidden sm:inline">
                • {activeSession.workspacePaths[0]?.split('/').pop() || 'workspace'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--anchor-text-subtle)] hidden sm:inline">
              <Kbd>↵</Kbd> send · <Kbd>Shift+↵</Kbd> newline
            </span>

            {isStreaming ? (
              <Button
                variant="danger"
                size="xs"
                icon={<Square className="w-3 h-3 fill-current" />}
                onClick={() => stopStreaming(sessionId)}
              >
                Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                size="xs"
                disabled={!text.trim() && attachments.length === 0}
                icon={<CornerDownLeft className="w-3.5 h-3.5" />}
                onClick={handleSend}
              >
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
