import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import { cn } from '../lib/cn';

export interface MarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * Agent replies are GitHub-flavoured Markdown: tables, task lists, nested
 * lists, rules, strikethrough. A real parser renders them; the hand-written
 * one this replaced showed tables as rows of pipes and `---` as text. Raw
 * HTML in a reply is shown as text, never executed.
 */
const components: Components = {
  h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-[var(--anchor-text)]">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-1.5 text-[var(--anchor-text)]">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1 text-[var(--anchor-text)]">{children}</h3>,
  h4: ({ children }) => (
    <h4 className="text-xs font-semibold mt-2 mb-1 text-[var(--anchor-text-muted)] uppercase tracking-wider">{children}</h4>
  ),
  h5: ({ children }) => <h5 className="text-xs font-semibold mt-2 mb-1 text-[var(--anchor-text-muted)]">{children}</h5>,
  h6: ({ children }) => <h6 className="text-xs font-medium mt-2 mb-1 text-[var(--anchor-text-subtle)]">{children}</h6>,
  p: ({ children }) => <p className="text-xs leading-relaxed text-[var(--anchor-text)] my-1.5">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--anchor-text)]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-[var(--anchor-text-subtle)]">{children}</del>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--anchor-accent)] underline underline-offset-2 hover:text-[var(--anchor-accent-hover)] break-words"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-0 border-t border-[var(--anchor-border)]" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[var(--anchor-accent)] pl-3 my-2 text-[var(--anchor-text-muted)]">{children}</blockquote>
  ),
  ul: ({ children, className }) => (
    <ul
      className={cn(
        'my-1.5 space-y-1 text-xs',
        className?.includes('contains-task-list') ? 'list-none pl-1' : 'list-disc pl-5 marker:text-[var(--anchor-accent)]'
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol start={start} className="my-1.5 space-y-1 text-xs list-decimal pl-5 marker:text-[var(--anchor-text-subtle)] marker:font-mono">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed text-[var(--anchor-text)] [&>p]:my-0.5 [&>ul]:my-1 [&>ol]:my-1">{children}</li>,
  input: ({ checked }) => (
    <input type="checkbox" checked={Boolean(checked)} readOnly className="mr-1.5 align-middle accent-[var(--anchor-accent)]" />
  ),
  // Wide tables scroll inside their own box instead of stretching the chat.
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-[var(--anchor-border)]">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[var(--anchor-surface-sunken)]">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-[var(--anchor-border-subtle)] last:border-b-0">{children}</tr>,
  th: ({ children, style }) => (
    <th style={style} className="px-3 py-1.5 text-left font-semibold text-[var(--anchor-text)] whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-1.5 align-top text-[var(--anchor-text)]">
      {children}
    </td>
  ),
  img: ({ src, alt }) => (
    <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} className="my-2 max-w-full max-h-96 rounded-lg border border-[var(--anchor-border)]" />
  ),
  // Fenced blocks arrive as <pre><code class="language-x">; CodeBlock draws
  // its own frame, so <pre> passes its child through.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children ?? '');
    const lang = /language-([\w+-]+)/.exec(className ?? '')?.[1];
    if (lang || text.includes('\n')) {
      return <CodeBlock code={text.replace(/\n$/, '')} language={lang ?? 'text'} />;
    }
    return (
      <code className="px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono bg-[var(--anchor-surface-sunken)] text-[var(--anchor-accent)] border border-[var(--anchor-border)] break-words">
        {children}
      </code>
    );
  },
};

export const MarkdownView: React.FC<MarkdownViewProps> = React.memo(({ content, className }) => (
  <div className={cn('text-sm text-[var(--anchor-text)] selectable leading-relaxed break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
));
MarkdownView.displayName = 'MarkdownView';
