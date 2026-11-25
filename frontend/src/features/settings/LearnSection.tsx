import React, { useEffect, useState } from 'react';
import type { ListingKind } from '../../bridge/types';
import { useSettingsStore } from '../../store/settings';
import { useLearnStore } from '../../store/learn';
import { useSkillsStore } from '../../store/skills';
import { useAgentsStore } from '../../store/agents';
import { useMarketStore } from '../../store/market';
import { confirmDialog } from '../../store/confirm';
import { getBridge } from '../../bridge';
import { Switch } from '../../components/Switch';
import { Button } from '../../components/Button';
import { SuggestionCard } from '../learn/SuggestionCard';
import { PublishWizard } from '../market/PublishWizard';
import { formatRelativeDate } from '../../lib/format';
import { GraduationCap, Sparkles } from 'lucide-react';

/**
 * "Learn from my work". Off until the user switches it on. When on, Anchor
 * studies the user's own messages from recent chats (once a day, or on
 * demand) and proposes standing instructions, skills and agents. Every
 * proposal waits here as a draft; nothing changes without approval.
 */
export const LearnSection: React.FC = () => {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const status = useLearnStore((s) => s.status);
  const suggestions = useLearnStore((s) => s.suggestions);
  const lastResult = useLearnStore((s) => s.lastResult);
  const error = useLearnStore((s) => s.error);
  const load = useLearnStore((s) => s.load);
  const run = useLearnStore((s) => s.run);
  const accept = useLearnStore((s) => s.accept);
  const reject = useLearnStore((s) => s.reject);
  const forget = useLearnStore((s) => s.forget);
  const setStatus = useLearnStore((s) => s.setStatus);

  const skills = useSkillsStore((s) => s.skills);
  const loadSkills = useSkillsStore((s) => s.loadSkills);
  const agents = useAgentsStore((s) => s.agents);
  const loadAgents = useAgentsStore((s) => s.loadAgents);
  const plugins = useMarketStore((s) => s.plugins);

  const [showDecided, setShowDecided] = useState(false);
  const [share, setShare] = useState<{ kind: ListingKind; id: string } | null>(null);

  const enabled = Boolean(settings.learnEnabled);
  const auto = settings.learnAuto !== false;
  const running = Boolean(status?.running);

  useEffect(() => {
    void load();
    const off = getBridge().learn.onStatus(setStatus);
    return off;
  }, [load, setStatus, enabled]);

  const drafts = suggestions.filter((s) => s.status === 'draft');
  const decided = suggestions.filter((s) => s.status !== 'draft');

  const openShare = async (kind: ListingKind, id: string) => {
    await Promise.all([loadSkills(), loadAgents()]);
    setShare({ kind, id });
  };

  const handleForget = async () => {
    const ok = await confirmDialog({
      title: 'Forget everything learned?',
      message: 'Drafts, your past decisions and the run history are erased. Instructions, skills and agents you already approved stay as they are.',
      confirmLabel: 'Forget',
      danger: true,
    });
    if (ok) await forget();
  };

  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--anchor-border-subtle)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-accent)]">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--anchor-text)]">Learn from my work</h3>
            <p className="text-xs text-[var(--anchor-text-muted)]">
              Anchor studies how you work and proposes instructions, skills and agents. You approve each one; nothing changes on its own.
            </p>
          </div>
        </div>
        <Switch checked={enabled} onChange={(v) => updateSettings({ learnEnabled: v })} id="learn-from-my-work" />
      </div>

      {!enabled ? (
        <ul className="text-xs text-[var(--anchor-text-muted)] space-y-1.5 list-disc pl-5">
          <li>Reads only your own messages from recent chats on this device, never the agent's replies or your files.</li>
          <li>Corrections you repeat become proposed standing instructions. Work you repeat becomes a draft skill or agent.</li>
          <li>Each study is one agent turn and uses a little of your allowance: at most once a day, or when you press the button.</li>
          <li>Approved skills and agents are yours. Sharing them on the Marketplace is a separate, optional step.</li>
        </ul>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <Switch
                checked={auto}
                onChange={(v) => updateSettings({ learnAuto: v })}
                label="Study automatically, at most once a day"
                description="Only when there are new messages since the last study."
              />
              <span className="text-[11px] text-[var(--anchor-text-subtle)] block">
                {running
                  ? 'Studying your recent work…'
                  : status?.lastRunAt
                    ? `Last studied ${formatRelativeDate(status.lastRunAt).toLowerCase()}`
                    : 'Not studied yet'}
              </span>
            </div>
            <Button variant="primary" size="sm" loading={running} icon={<Sparkles className="w-3.5 h-3.5" />} onClick={() => run()}>
              Learn now
            </Button>
          </div>

          {error && <div className="p-2.5 rounded-lg bg-[var(--anchor-danger)]/10 text-[11px] text-[var(--anchor-danger)]">{error}</div>}
          {!error && lastResult && (
            <div className="p-2.5 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-[11px] text-[var(--anchor-text-muted)]">{lastResult}</div>
          )}

          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)] block">
              Waiting for your review ({drafts.length})
            </span>
            {drafts.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-[var(--anchor-border)] text-xs text-[var(--anchor-text-subtle)]">
                No drafts. Suggestions appear here when something in your work clearly repeats.
              </div>
            ) : (
              drafts.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onAccept={async (edit) => {
                    await accept(s.id, edit);
                  }}
                  onReject={() => reject(s.id)}
                />
              ))
            )}
          </div>

          {decided.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowDecided((v) => !v)}
                  className="text-xs font-medium text-[var(--anchor-text-muted)] hover:text-[var(--anchor-text)] cursor-pointer"
                >
                  {showDecided ? 'Hide' : 'Show'} earlier decisions ({decided.length})
                </button>
                <button onClick={handleForget} className="text-[11px] text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-danger)] cursor-pointer">
                  Forget everything learned
                </button>
              </div>
              {showDecided &&
                decided.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    onAccept={async () => {}}
                    onReject={async () => {}}
                    onShare={s.createdId && s.kind !== 'rule' ? () => openShare(s.kind as ListingKind, s.createdId!) : undefined}
                  />
                ))}
            </div>
          )}
        </>
      )}

      {share && (
        <PublishWizard skills={skills} agents={agents} plugins={plugins} initial={share} open={true} onClose={() => setShare(null)} />
      )}
    </div>
  );
};
