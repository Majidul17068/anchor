import React, { useState } from 'react';
import type { Suggestion, SuggestionEdit } from '../../bridge/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { formatRelativeDate } from '../../lib/format';
import { Bot, Check, Layers, Pencil, ScrollText, Upload, X } from 'lucide-react';

export interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (edit: SuggestionEdit) => Promise<void>;
  onReject: () => Promise<void>;
  /** Offered after a skill or agent was approved. */
  onShare?: () => void;
}

const KIND = {
  rule: { label: 'Standing instruction', icon: <ScrollText className="w-3.5 h-3.5" />, verb: 'Add to my instructions' },
  skill: { label: 'Skill', icon: <Layers className="w-3.5 h-3.5" />, verb: 'Create skill' },
  agent: { label: 'Agent', icon: <Bot className="w-3.5 h-3.5" />, verb: 'Create agent' },
} as const;

const area =
  'w-full bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-lg p-2.5 text-xs text-[var(--anchor-text)] focus:outline-none focus:border-[var(--anchor-border-focus)] font-mono leading-relaxed';

/**
 * One proposal: what it is, why Anchor thinks so (with the user's own
 * words), exactly what would be added, and the decision. The content can be
 * edited before it is approved; nothing changes until then.
 */
export const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion: s, onAccept, onReject, onShare }) => {
  const k = KIND[s.kind];
  const draft = s.status === 'draft';
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [rule, setRule] = useState(s.rule ?? '');
  const [name, setName] = useState(s.name ?? '');
  const [description, setDescription] = useState(s.description ?? '');
  const [body, setBody] = useState(s.body ?? '');

  const edit: SuggestionEdit = s.kind === 'rule' ? { rule } : { name, description, body };
  const valid = s.kind === 'rule' ? rule.trim().length > 0 : name.trim().length > 0 && body.trim().length > 0;

  const accept = async () => {
    setBusy('accept');
    await onAccept(edit);
    setBusy(null);
  };
  const reject = async () => {
    setBusy('reject');
    await onReject();
    setBusy(null);
  };

  return (
    <div className="p-4 bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] rounded-xl space-y-3 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={s.kind === 'rule' ? 'info' : 'accent'} size="xs">
              <span className="mr-1 inline-flex">{k.icon}</span>
              {k.label}
            </Badge>
            {s.status === 'accepted' && <Badge variant="ok" size="xs">Approved</Badge>}
            {s.status === 'rejected' && <Badge variant="default" size="xs">Dismissed</Badge>}
            <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">{formatRelativeDate(s.decidedAt || s.createdAt)}</span>
          </div>
          <h4 className="text-sm font-semibold text-[var(--anchor-text)]">{s.title}</h4>
          <p className="text-xs text-[var(--anchor-text-muted)]">{s.reason}</p>
        </div>
      </div>

      {s.evidence.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">From your messages</span>
          {s.evidence.map((e, i) => (
            <p key={i} className="text-[11px] text-[var(--anchor-text-muted)] border-l-2 border-[var(--anchor-border)] pl-2 italic selectable">
              “{e}”
            </p>
          ))}
        </div>
      )}

      {/* Exactly what approving adds */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
          {s.kind === 'rule' ? 'Would be added to your standing instructions' : `The ${s.kind} that would be created`}
        </span>
        {s.kind === 'rule' ? (
          editing && draft ? (
            <textarea value={rule} onChange={(e) => setRule(e.target.value)} rows={2} aria-label="Instruction" className={area} />
          ) : (
            <p className="text-xs text-[var(--anchor-text)] bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-lg p-2.5 selectable">
              <span className="text-[var(--anchor-ok)] font-mono mr-1.5">+</span>
              {rule}
            </p>
          )
        ) : editing && draft ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="When to use it" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} aria-label="Instructions" className={area} />
          </div>
        ) : (
          <div className="bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-lg p-2.5 space-y-1.5">
            <div className="text-xs">
              <span className="font-mono font-semibold text-[var(--anchor-accent)]">{name}</span>
              {description && <span className="text-[var(--anchor-text-muted)]"> · {description}</span>}
            </div>
            <pre className="text-[11px] text-[var(--anchor-text-muted)] font-mono whitespace-pre-wrap break-words max-h-44 overflow-y-auto selectable">{body}</pre>
            {s.kind === 'agent' && s.tools && s.tools.length > 0 && (
              <div className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">tools: {s.tools.join(', ')}</div>
            )}
          </div>
        )}
      </div>

      {draft ? (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button size="xs" variant="ghost" icon={<X className="w-3.5 h-3.5" />} loading={busy === 'reject'} onClick={reject}>
            Dismiss
          </Button>
          <Button size="xs" variant="outline" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditing((v) => !v)}>
            {editing ? 'Preview' : 'Edit'}
          </Button>
          <Button size="xs" variant="primary" icon={<Check className="w-3.5 h-3.5" />} loading={busy === 'accept'} disabled={!valid} onClick={accept}>
            {k.verb}
          </Button>
        </div>
      ) : (
        s.status === 'accepted' &&
        s.createdId &&
        onShare && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-[var(--anchor-text-subtle)]">
              In your {s.kind === 'skill' ? 'skills' : 'agents'} now, for your own use. Sharing is optional.
            </span>
            <Button size="xs" variant="outline" icon={<Upload className="w-3.5 h-3.5" />} onClick={onShare}>
              Share on Marketplace
            </Button>
          </div>
        )
      )}
    </div>
  );
};
