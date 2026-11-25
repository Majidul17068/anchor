import React, { useEffect, useState } from 'react';
import type { Automation, AutomationRun } from '../../bridge/types';
import { getBridge } from '../../bridge';
import { useAutomationsStore } from '../../store/automations';
import { useAgentsStore } from '../../store/agents';
import { confirmDialog } from '../../store/confirm';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Switch } from '../../components/Switch';
import { AutomationEditor } from './AutomationEditor';
import { formatRelativeFuture, formatRunLength } from './time';
import { formatRelativeDate } from '../../lib/format';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';

export interface AutomationsPageProps {
  /** Open the conversation a run happened in. */
  onOpenSession: (sessionId: string) => void;
}

const ACCESS_LABEL = { read: 'Look and report', edit: 'May change files', full: 'May run commands' } as const;
const TRIGGER_LABEL = { schedule: 'On schedule', manual: 'Run by you', 'catch-up': 'Made up a missed run' } as const;

const RunStatus: React.FC<{ run: AutomationRun }> = ({ run }) =>
  run.status === 'running' ? (
    <span className="inline-flex items-center gap-1 text-[var(--anchor-accent)]">
      <Loader2 className="w-3 h-3 animate-spin" /> Running
    </span>
  ) : run.status === 'ok' ? (
    <span className="inline-flex items-center gap-1 text-[var(--anchor-ok)]">
      <CheckCircle2 className="w-3 h-3" /> Finished
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[var(--anchor-danger)]">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  );

/**
 * Automations: tasks Anchor runs on a schedule. Each run starts a fresh
 * conversation with the automation's prompt and is kept as a session.
 */
export const AutomationsPage: React.FC<AutomationsPageProps> = ({ onOpenSession }) => {
  const list = useAutomationsStore((s) => s.list);
  const importable = useAutomationsStore((s) => s.importable);
  const runs = useAutomationsStore((s) => s.runs);
  const background = useAutomationsStore((s) => s.background);
  const loaded = useAutomationsStore((s) => s.loaded);
  const error = useAutomationsStore((s) => s.error);
  const load = useAutomationsStore((s) => s.load);
  const loadRuns = useAutomationsStore((s) => s.loadRuns);
  const save = useAutomationsStore((s) => s.save);
  const setEnabled = useAutomationsStore((s) => s.setEnabled);
  const remove = useAutomationsStore((s) => s.remove);
  const runNow = useAutomationsStore((s) => s.runNow);
  const setBackground = useAutomationsStore((s) => s.setBackground);
  const clearError = useAutomationsStore((s) => s.clearError);

  const agents = useAgentsStore((s) => s.agents);
  const models = useAgentsStore((s) => s.models);
  const loadAgents = useAgentsStore((s) => s.loadAgents);

  const [editing, setEditing] = useState<Partial<Automation> | null | undefined>(undefined); // undefined = closed
  const [open, setOpen] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [, setNow] = useState(0);

  useEffect(() => {
    void load();
    void loadAgents();
    const off = getBridge().automations.onChange(() => void load());
    const t = setInterval(() => setNow((n) => n + 1), 30_000); // keep "in 14 minutes" moving
    return () => {
      off();
      clearInterval(t);
    };
  }, [load, loadAgents]);

  const toggleHistory = (id: string) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    void loadRuns(id);
  };

  const handleDelete = async (a: Automation) => {
    const ok = await confirmDialog({
      title: `Delete "${a.name}"?`,
      message: 'The automation and its run history are removed. Conversations its runs produced stay in your sessions.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) await remove(a.id);
  };

  const handleExport = async (a: Automation) => {
    try {
      const path = await getBridge().automations.exportToCli(a.id);
      setExported(`"${a.name}" was written in the Antigravity CLI's format: ${path}. It appears in Google's Automations dashboard switched off. Leave it off there while it is on here, or it runs twice.`);
    } catch (e) {
      setExported(`Could not export: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const anyOn = list.some((a) => a.enabled);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--anchor-bg)] overflow-hidden text-left">
      <div className="p-4 border-b border-[var(--anchor-border)] bg-[var(--anchor-surface)] flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <CalendarClock className="w-4 h-4 text-[var(--anchor-accent)]" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--anchor-text)]">Automations</h2>
            <p className="text-[11px] text-[var(--anchor-text-muted)]">
              Tasks Anchor runs for you on a schedule. Each run is a fresh conversation you can open afterwards.
            </p>
          </div>
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { clearError(); setEditing(null); }}>
          New automation
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* When automations can run */}
          <div className="p-3.5 rounded-xl border border-[var(--anchor-border)] bg-[var(--anchor-surface)] flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 min-w-[260px] flex-1">
              <p className="text-xs text-[var(--anchor-text-muted)]">
                Automations run while Anchor is running.
                {background?.runInBackground
                  ? background.active
                    ? ' Closing the window keeps Anchor running in the background.'
                    : ' Restart Anchor once for "keep running" to take effect.'
                  : ' With the switches off, they stop when you quit Anchor.'}
              </p>
              <Switch
                checked={Boolean(background?.runInBackground)}
                onChange={(v) => setBackground(v, v ? Boolean(background?.startAtLogin) : false)}
                label="Keep running when I close the window"
                description="Open Anchor again from your applications to bring the window back."
              />
              <Switch
                checked={Boolean(background?.startAtLogin)}
                onChange={(v) => setBackground(v || Boolean(background?.runInBackground), v)}
                label="Start Anchor when I sign in to this computer"
                description="Starts in the background, without a window."
              />
            </div>
            {background?.active && (
              <Button size="xs" variant="ghost" onClick={() => getBridge().automations.quit()}>
                Quit Anchor completely
              </Button>
            )}
          </div>

          {error && editing === undefined && (
            <div className="p-2.5 rounded-lg bg-[var(--anchor-danger)]/10 text-[11px] text-[var(--anchor-danger)]">{error}</div>
          )}
          {exported && (
            <div className="p-2.5 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-[11px] text-[var(--anchor-text-muted)] flex items-start justify-between gap-3 selectable">
              <span>{exported}</span>
              <button onClick={() => setExported(null)} className="text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] shrink-0">Dismiss</button>
            </div>
          )}

          {loaded && list.length === 0 && (
            <div className="p-8 rounded-xl border border-dashed border-[var(--anchor-border)] text-center space-y-3">
              <CalendarClock className="w-8 h-8 mx-auto text-[var(--anchor-text-subtle)]" />
              <p className="text-sm font-semibold text-[var(--anchor-text)]">No automations yet</p>
              <p className="text-xs text-[var(--anchor-text-muted)] max-w-md mx-auto">
                Give Anchor a task and a schedule, for example: every weekday at 9:00, list my open pull requests and flag failing checks.
              </p>
              <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing(null)}>
                Create your first automation
              </Button>
            </div>
          )}

          {list.map((a) => {
            const last = a.lastRun;
            const history = runs[a.id] ?? [];
            const isOpen = open === a.id;
            return (
              <div key={a.id} className="rounded-xl border border-[var(--anchor-border)] bg-[var(--anchor-surface)] overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--anchor-text)] truncate">{a.name}</h3>
                        {a.running && (
                          <Badge variant="accent" size="xs">
                            <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> Running now
                          </Badge>
                        )}
                        {a.access === 'full' && (
                          <span title="This automation may run commands without asking.">
                            <Badge variant="warn" size="xs">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Runs commands
                            </Badge>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--anchor-text-muted)]">
                        {a.scheduleText}
                        {a.enabled && a.nextRunAt ? ` · next run ${formatRelativeFuture(a.nextRunAt)}` : a.enabled ? '' : ' · switched off'}
                      </p>
                      <p className="text-xs text-[var(--anchor-text-subtle)] line-clamp-2 selectable">{a.prompt}</p>
                    </div>
                    <Switch checked={a.enabled} onChange={(v) => setEnabled(a.id, v)} id={`auto-${a.id}`} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--anchor-border-subtle)]">
                    <div className="text-[11px] text-[var(--anchor-text-subtle)] flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                      <span>{ACCESS_LABEL[a.access]}</span>
                      {last ? (
                        <>
                          <span>·</span>
                          <span>Last run {formatRelativeDate(last.startedAt).toLowerCase()}:</span>
                          <RunStatus run={last} />
                        </>
                      ) : (
                        <>
                          <span>·</span>
                          <span>Has not run yet</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="xs" variant="ghost" icon={isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} onClick={() => toggleHistory(a.id)}>
                        History
                      </Button>
                      <Button size="xs" variant="ghost" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => handleExport(a)}>
                        Export
                      </Button>
                      <Button size="xs" variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(a)}>
                        Delete
                      </Button>
                      <Button size="xs" variant="outline" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => { clearError(); setEditing(a); }}>
                        Edit
                      </Button>
                      <Button size="xs" variant="primary" disabled={a.running} icon={<Play className="w-3.5 h-3.5" />} onClick={() => runNow(a.id)}>
                        Run now
                      </Button>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] p-3 space-y-2">
                    {history.length === 0 ? (
                      <p className="text-[11px] text-[var(--anchor-text-subtle)] px-1">No runs yet. Press Run now to try it.</p>
                    ) : (
                      history.map((r) => (
                        <div key={r.id} className="p-2.5 rounded-lg bg-[var(--anchor-surface)] border border-[var(--anchor-border)] text-xs space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                              <RunStatus run={r} />
                              <span className="text-[var(--anchor-text-subtle)]">
                                {new Date(r.startedAt).toLocaleString()} · {TRIGGER_LABEL[r.trigger]}
                                {r.finishedAt ? ` · took ${formatRunLength(r.startedAt, r.finishedAt)}` : ''}
                              </span>
                            </div>
                            {r.sessionId && (
                              <Button size="xs" variant="ghost" icon={<ExternalLink className="w-3 h-3" />} onClick={() => onOpenSession(r.sessionId!)}>
                                Open conversation
                              </Button>
                            )}
                          </div>
                          {r.error && <p className="text-[11px] text-[var(--anchor-danger)] selectable">{r.error}</p>}
                          {r.summary && <p className="text-[11px] text-[var(--anchor-text-muted)] whitespace-pre-wrap line-clamp-4 selectable">{r.summary}</p>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* The CLI's own automations, ready to bring in */}
          {importable.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)] block">
                Found in the Antigravity CLI ({importable.length})
              </span>
              {importable.map((a) => (
                <div key={a.name} className="p-3 rounded-xl border border-dashed border-[var(--anchor-border)] flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-[var(--anchor-text)] block truncate">{a.name}</span>
                    <span className="text-[11px] text-[var(--anchor-text-subtle)] block truncate">{a.scheduleText} · {a.prompt}</span>
                  </div>
                  <Button size="xs" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={() => { clearError(); setEditing({ ...a, id: undefined, enabled: false }); }}>
                    Bring into Anchor
                  </Button>
                </div>
              ))}
            </div>
          )}

          {anyOn && !background?.runInBackground && (
            <p className="text-[11px] text-[var(--anchor-text-subtle)]">
              Tip: with "Keep running when I close the window" off, a scheduled time that passes while Anchor is closed is made up at the next start only for automations set to make up a missed run.
            </p>
          )}
        </div>
      </div>

      {editing !== undefined && (
        <AutomationEditor
          automation={editing}
          agents={agents}
          models={models}
          error={error}
          onSave={async (a) => Boolean(await save(a))}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
};
