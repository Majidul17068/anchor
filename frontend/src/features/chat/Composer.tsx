import React, { useState, useRef, useEffect } from 'react';
import type { Attachment } from '../../bridge/types';
import { useChatStore } from '../../store/chat';
import { useSessionStore } from '../../store/session';
import { getBridge } from '../../bridge';
import { Button } from '../../components/Button';
import { Kbd } from '../../components/Kbd';
import { AttachmentChip } from './AttachmentChip';
import { CornerDownLeft, Paperclip, Square } from 'lucide-react';
import { cn } from '../../lib/cn';

// Pasted text beyond this is attached as a file instead of filling the box.
const LONG_PASTE_CHARS = 4000;
const LONG_PASTE_LINES = 60;

export interface ComposerProps {
  sessionId: string;
}

export const Composer: React.FC<ComposerProps> = ({ sessionId }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [attaching, setAttaching] = useState(0);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
    if ((!text.trim() && attachments.length === 0) || isStreaming || attaching > 0) return;
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

  // Pasted or dropped content has no path the CLI could read, so it is
  // saved through the desktop shell and attached like a picked file.
  const saveBlob = async (blob: Blob, name: string) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error ?? new Error('could not read the file'));
      r.readAsDataURL(blob);
    });
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return getBridge().system.saveAttachment(name, blob.type, base64);
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setAttachError(null);
    setAttaching((n) => n + files.length);
    for (const f of files) {
      try {
        const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
        // Clipboard images arrive as "image.png"; give each its own name.
        const name = !f.name || /^image\.\w+$/i.test(f.name) ? `Pasted image ${stamp}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}` : f.name;
        const att = await saveBlob(f, name);
        setAttachments((prev) => [...prev, att]);
      } catch (e) {
        setAttachError(e instanceof Error ? e.message : String(e));
      } finally {
        setAttaching((n) => n - 1);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
      return;
    }
    // A long paste (a log, a whole file) becomes an attachment so the box
    // stays readable; the agent still receives the full text.
    const pasted = e.clipboardData.getData('text/plain');
    if (pasted.length > LONG_PASTE_CHARS || pasted.split('\n').length > LONG_PASTE_LINES) {
      e.preventDefault();
      const lines = pasted.split('\n').length;
      void addFiles([new File([pasted], `Pasted text (${lines} lines).txt`, { type: 'text/plain' })]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    void addFiles(Array.from(e.dataTransfer.files));
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
      {(attachments.length > 0 || attaching > 0) && (
        <div className="flex flex-wrap items-end gap-2.5 mb-2 pt-1">
          {attachments.map((att, i) => (
            <AttachmentChip key={att.path + i} attachment={att} onRemove={() => removeAttachment(i)} />
          ))}
          {attaching > 0 && (
            <span className="text-[11px] text-[var(--anchor-text-subtle)] animate-pulse-subtle">
              Attaching {attaching} item{attaching > 1 ? 's' : ''}…
            </span>
          )}
        </div>
      )}
      {attachError && (
        <div className="mb-2 text-[11px] text-[var(--anchor-danger)]">Could not attach: {attachError}</div>
      )}

      {/* Input container: also the drop target for files and images */}
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'relative bg-[var(--anchor-surface)] border rounded-xl p-2.5 transition-all shadow-xs focus-within:border-[var(--anchor-border-focus)]',
          dragOver ? 'border-[var(--anchor-accent)] ring-1 ring-[var(--anchor-accent)]' : 'border-[var(--anchor-border)]'
        )}
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 rounded-xl bg-[var(--anchor-surface)]/90 flex items-center justify-center text-xs font-medium text-[var(--anchor-accent)] pointer-events-none">
            Drop to attach
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask Antigravity agent, paste or drop an image or file, or type '/' for commands..."
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
                disabled={(!text.trim() && attachments.length === 0) || attaching > 0}
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
