import React, { useEffect, useState } from 'react';
import type { Agent, Automation, AutomationAccess, AutomationSchedule, Model } from '../../bridge/types';
import { getBridge } from '../../bridge';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Switch } from '../../components/Switch';
import { formatRelativeFuture } from './time';
import { Check, FolderOpen, X } from 'lucide-react';

export interface AutomationEditorProps {
  /** The automation being edited, a draft to start from (import), or null for a new one. */
  automation: Partial<Automation> | null;
  agents: Agent[];
  models: Model[];
  error: string | null;
  onSave: (a: Partial<Automation> & Pick<Automation, 'name' | 'prompt' | 'schedule' | 'access'>) => Promise<boolean>;
  onClose: () => void;
}

const DAYS = [
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
  { n: 0, label: 'Sun' },
];

const ACCESS: { value: AutomationAccess; label: string; detail: string }[] = [
  { value: 'read', label: 'Look and report', detail: 'Reads and answers. Every file change or command is refused.' },
  { value: 'edit', label: 'May change files', detail: 'May also edit files in the folder below. Commands are refused.' },
  { value: 'full', label: 'May run commands', detail: 'May edit files and run commands without asking. Only for tasks you trust.' },
];

const area =
  'w-full bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-lg p-2.5 text-xs text-[var(--anchor-text)] focus:outline-none focus:border-[var(--anchor-border-focus)] leading-relaxed';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Create or edit an automation: what to do, when, and what the run may do
 * with nobody to ask. The schedule is shown in words with its next run as
 * it is edited.
 */
export const AutomationEditor: React.FC<AutomationEditorProps> = ({ automation, agents, models, error, onSave, onClose }) => {
  const a = automation ?? {};
  const [name, setName] = useState(a.name ?? '');
  const [prompt, setPrompt] = useState(a.prompt ?? '');
  const [schedule, setSchedule] = useState<AutomationSchedule>(
    a.schedule ? { ...a.schedule, weekdays: a.schedule.weekdays ?? [] } : { kind: 'daily', minute: 0, hour: 9, weekdays: [1, 2, 3, 4, 5] }
  );
  const [access, setAccess] = useState<AutomationAccess>(a.access ?? 'read');
  const [workspace, setWorkspace] = useState(a.workspace ?? '');
  const [agentId, setAgentId] = useState(a.agentId ?? '');
  const [modelId, setModelId] = useState(a.modelId ?? '');
  const [catchUp, setCatchUp] = useState(a.catchUp ?? true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ text: string; nextRunAt: string } | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Say the schedule back in words, with its next run, as it changes.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      getBridge()
        .automations.preview(schedule)
        .then((p) => {
          if (alive) {
            setPreview(p);
            setScheduleError(null);
          }
        })
        .catch((e) => {
          if (alive) {
            setPreview(null);
            setScheduleError(e instanceof Error ? e.message : String(e));
          }
        });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [schedule]);

  const time = `${pad(schedule.hour)}:${pad(schedule.minute)}`;
  const setTime = (v: string) => {
    const [h, m] = v.split(':').map((x) => parseInt(x, 10));
    if (Number.isFinite(h) && Number.isFinite(m)) setSchedule((s) => ({ ...s, hour: h, minute: m }));
  };
  const toggleDay = (n: number) =>
    setSchedule((s) => ({ ...s, weekdays: s.weekdays.includes(n) ? s.weekdays.filter((d) => d !== n) : [...s.weekdays, n].sort() }));

  const valid = name.trim() && prompt.trim() && !scheduleError && preview;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    const ok = await onSave({
      id: a.id,
      name: name.trim(),
      prompt: prompt.trim(),
      description: a.description,
      schedule,
      access,
      workspace: workspace || undefined,
      agentId: agentId || undefined,
      modelId: modelId || undefined,
      catchUp,
      enabled: a.id ? a.enabled : true,
    });
    setSaving(false);
    if (ok) onClose();
  };

  const pickFolder = async () => {
    const p = await getBridge().system.pickFolder();
    if (p) setWorkspace(p);
  };

  const myAgents = agents.filter((x) => x.discovered !== false);

  return (
    <Dialog
      open
      onClose={onClose}
      title={a.id ? 'Edit automation' : 'New automation'}
      description="Anchor starts a fresh conversation with this prompt on schedule and keeps what happened."
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <span className="text-[11px] text-[var(--anchor-text-subtle)] truncate">
            {scheduleError ? scheduleError : preview ? `${preview.text} · next run ${formatRelativeFuture(preview.nextRunAt)}` : ''}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} disabled={!valid} icon={<Check className="w-3.5 h-3.5" />} onClick={handleSave}>
              {a.id ? 'Save' : 'Create automation'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-left text-xs">
        <Input label="Name" placeholder="e.g. Morning pull request check" value={name} onChange={(e) => setName(e.target.value)} />

        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1">What should it do each time?</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Write the whole task. Each run is a new conversation with no memory of earlier runs, so say where to look, what to do, and how to present the result."
            className={area}
          />
        </div>

        {/* Schedule */}
        <div className="p-3.5 rounded-xl border border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="How often"
              value={schedule.kind}
              onChange={(e) => setSchedule((s) => ({ ...s, kind: e.target.value as AutomationSchedule['kind'] }))}
              options={[
                { value: 'hourly', label: 'Every hour' },
                { value: 'daily', label: 'Every day' },
                { value: 'weekly', label: 'On chosen days of the week' },
                { value: 'custom', label: 'Custom (cron expression)' },
              ]}
            />
            {schedule.kind === 'hourly' && (
              <Input
                label="Minutes past the hour"
                type="number"
                min={0}
                max={59}
                value={schedule.minute}
                onChange={(e) => setSchedule((s) => ({ ...s, minute: Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)) }))}
              />
            )}
            {(schedule.kind === 'daily' || schedule.kind === 'weekly') && (
              <Input label="At (your local time)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            )}
            {schedule.kind === 'custom' && (
              <Input
                label="Cron: minute hour day month weekday"
                placeholder="*/30 9-17 * * 1-5"
                value={schedule.cron ?? ''}
                onChange={(e) => setSchedule((s) => ({ ...s, cron: e.target.value }))}
                className="font-mono"
              />
            )}
          </div>
          {schedule.kind === 'weekly' && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
              {DAYS.map((d) => {
                const on = schedule.weekdays.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(d.n)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${
                      on
                        ? 'bg-[var(--anchor-accent)] text-white border-[var(--anchor-accent)]'
                        : 'bg-[var(--anchor-surface)] border-[var(--anchor-border)] text-[var(--anchor-text-muted)] hover:bg-[var(--anchor-surface-hover)]'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          )}
          <Switch
            checked={catchUp}
            onChange={setCatchUp}
            label="Make up a missed run"
            description="If Anchor was closed or the computer asleep at the scheduled time, run once when Anchor next starts."
          />
        </div>

        {/* What a run may do */}
        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1.5">
            What may it do without asking? Nobody is there to approve during a run.
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2" role="radiogroup" aria-label="Access">
            {ACCESS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={access === o.value}
                onClick={() => setAccess(o.value)}
                className={`p-2.5 rounded-lg border text-left cursor-pointer ${
                  access === o.value
                    ? 'border-[var(--anchor-accent)] ring-1 ring-[var(--anchor-accent)] bg-[var(--anchor-surface)]'
                    : 'border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] hover:bg-[var(--anchor-surface-hover)]'
                }`}
              >
                <span className="block text-xs font-semibold text-[var(--anchor-text)]">{o.label}</span>
                <span className="block text-[11px] text-[var(--anchor-text-subtle)] mt-0.5 leading-snug">{o.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1">Folder it works in</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] font-mono text-[11px] text-[var(--anchor-text-muted)] truncate" title={workspace}>
              {workspace || 'Your home folder'}
            </div>
            {workspace && (
              <button onClick={() => setWorkspace('')} aria-label="Clear folder" className="p-1.5 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <Button size="xs" variant="outline" icon={<FolderOpen className="w-3.5 h-3.5" />} onClick={pickFolder}>
              Choose
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="Agent"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            options={[{ value: '', label: 'Antigravity default' }, ...myAgents.map((x) => ({ value: x.id, label: x.name }))]}
          />
          <Select
            label="Model"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            options={[{ value: '', label: 'Default model' }, ...models.map((m) => ({ value: m.id, label: m.label }))]}
          />
        </div>

        {error && <div className="p-2.5 rounded-lg bg-[var(--anchor-danger)]/10 text-[11px] text-[var(--anchor-danger)]">{error}</div>}
      </div>
    </Dialog>
  );
};
