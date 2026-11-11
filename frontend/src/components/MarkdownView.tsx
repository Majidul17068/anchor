import React from 'react';
import { parseMarkdownBlocks } from '../lib/markdown';
import { CodeBlock } from './CodeBlock';
import { cn } from '../lib/cn';

export interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className }) => {
  const blocks = parseMarkdownBlocks(content);

  const renderInline = (text: string) => {
    // Process bold, italics, inline code, links
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g);

    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono bg-[var(--anchor-surface-sunken)] text-[var(--anchor-accent)] border border-[var(--anchor-border)]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-[var(--anchor-text)]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return (
          <em key={i} className="italic text-[var(--anchor-text-muted)]">
            {part.slice(1, -1)}
          </em>
        );
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--anchor-accent)] underline hover:text-[var(--anchor-accent-hover)]"
          >
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn('text-sm text-[var(--anchor-text)] space-y-2 selectable leading-relaxed', className)}>
      {blocks.map((block, idx) => {
        if (block.type === 'code' || block.type === 'diff') {
          return <CodeBlock key={idx} code={block.content} language={block.lang} />;
        }
        if (block.type === 'heading') {
          const Tag = `h${Math.min(block.level || 1, 4)}` as keyof React.JSX.IntrinsicElements;
          const headingClasses = {
            1: 'text-lg font-bold mt-4 mb-2 text-[var(--anchor-text)]',
            2: 'text-base font-semibold mt-3 mb-1.5 text-[var(--anchor-text)]',
            3: 'text-sm font-semibold mt-2.5 mb-1 text-[var(--anchor-text)]',
            4: 'text-xs font-semibold mt-2 mb-1 text-[var(--anchor-text-muted)] uppercase tracking-wider',
          }[block.level || 1];

          return (
            <Tag key={idx} className={headingClasses}>
              {renderInline(block.content)}
            </Tag>
          );
        }
        if (block.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-[var(--anchor-accent)] pl-3 my-1 text-[var(--anchor-text-muted)] italic text-xs"
            >
              {renderInline(block.content)}
            </blockquote>
          );
        }
        if (block.type === 'list') {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 my-0.5 text-xs">
              <span className="text-[var(--anchor-accent)] select-none">•</span>
              <span>{renderInline(block.content)}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="text-xs leading-relaxed text-[var(--anchor-text)]">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
};
