import React, { useState } from 'react';
import type { Attachment } from '../../bridge/types';
import { MarkdownView } from '../../components/MarkdownView';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../store/auth';
import { AnchorGlyph } from '../../components/EmptyState';
import { Check, Copy, FileText } from 'lucide-react';
import { formatBytes } from '../../lib/format';
import { cn } from '../../lib/cn';

export interface MessageBubbleProps {
  kind: 'user' | 'agent';
  text?: string;
  markdown?: string;
  attachments?: Attachment[];
  at: string;
  streaming?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  kind,
  text,
  markdown,
  attachments,
  at,
  streaming,
}) => {
  const account = useAuthStore((s) => s.account);
  const [copied, setCopied] = useState(false);

  const rawContent = kind === 'user' ? text || '' : markdown || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const formattedTime = new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (kind === 'user') {
    return (
      <div className="flex justify-end gap-3 my-3 text-left">
        <div className="max-w-2xl flex flex-col items-end">
          <div className="bg-[var(--anchor-accent)] text-white px-4 py-3 rounded-2xl rounded-tr-xs shadow-xs text-xs leading-relaxed whitespace-pre-wrap selectable">
            {text}
          </div>

          {attachments && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-[11px] text-[var(--anchor-text)]"
                >
                  <FileText className="w-3.5 h-3.5 text-[var(--anchor-text-subtle)]" />
                  <span className="font-medium truncate max-w-[150px]">{att.name}</span>
                  <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">
                    ({formatBytes(att.size)})
                  </span>
                </div>
              ))}
            </div>
          )}

          <span className="text-[10px] text-[var(--anchor-text-subtle)] mt-1 px-1">
            {formattedTime}
          </span>
        </div>

        <Avatar
          name={account?.name || 'User'}
          src={account?.avatarUrl}
          size="sm"
          className="mt-1 shrink-0"
        />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 my-4 text-left group">
      <div className="w-7 h-7 rounded-lg bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] flex items-center justify-center shrink-0 text-[var(--anchor-accent)] mt-0.5 shadow-xs">
        <AnchorGlyph size={16} />
      </div>

      <div className="flex-1 max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between pb-1 select-none">
          <span className="text-xs font-semibold text-[var(--anchor-text)]">Anchor Agent</span>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              aria-label="Copy message"
              className="flex items-center gap-1 text-[11px] text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] p-1 rounded transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-[var(--anchor-ok)]" />
                  <span className="text-[10px] text-[var(--anchor-ok)]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">Copy</span>
                </>
              )}
            </button>
            <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">
              {formattedTime}
            </span>
          </div>
        </div>

        <div className="bg-[var(--anchor-surface)] border border-[var(--anchor-border-subtle)] rounded-xl p-4 shadow-xs">
          <MarkdownView content={markdown || ''} />
          {streaming && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-[var(--anchor-accent)] animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  );
};
