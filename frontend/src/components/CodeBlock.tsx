import React, { useState } from 'react';
import { cn } from '../lib/cn';
import { Check, Copy } from 'lucide-react';

export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'text',
  filename,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const lines = code.trim().split('\n');

  return (
    <div
      className={cn(
        'group relative my-2 rounded-lg border border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] text-xs font-mono overflow-hidden',
        className
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--anchor-surface-elevated)] border-b border-[var(--anchor-border)] text-[var(--anchor-text-subtle)] text-[11px] select-none">
        <span className="font-medium text-[var(--anchor-text-muted)]">
          {filename || language}
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy code block"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[var(--anchor-surface-hover)] text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] transition-colors cursor-pointer"
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
      </div>
      <pre className="p-3 overflow-x-auto text-[var(--anchor-text)] leading-relaxed selectable">
        <code>
          {lines.map((line, idx) => (
            <div key={idx} className="table-row">
              <span className="table-cell pr-3 select-none text-[var(--anchor-text-subtle)]/50 text-right w-6 text-[11px]">
                {idx + 1}
              </span>
              <span className="table-cell">{line}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
};
