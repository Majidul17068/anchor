import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { useSyncStore } from '../../store/sync';
import { useSettingsStore } from '../../store/settings';
import { getBridge } from '../../bridge';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Laptop, Pencil, Check } from 'lucide-react';

export interface StepProfileProps {
  /** Called with the saved values once the user confirms. */
  onComplete: () => void;
  /** The wizard's own Next button triggers this; the step saves then advances. */
  registerSave?: (save: () => Promise<boolean>) => void;
}

function splitName(full?: string): [string, string] {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ['', ''];
  if (parts.length === 1) return [parts[0], ''];
  return [parts[0], parts.slice(1).join(' ')];
}

const RULES_PLACEHOLDER = `Examples:
- Always answer in short paragraphs, no bullet lists unless I ask.
- Never run destructive commands (rm, git push --force) without asking first.
- Prefer TypeScript over JavaScript in every project.
- Call me Majid.`;

/**
 * About you: name, device name, and standing instructions the agent must
 * always follow. Saved into Anchor's settings; the instructions are also
 * written into the Antigravity CLI's global rules file so terminal sessions
 * follow them too.
 */
export const StepProfile: React.FC<StepProfileProps> = ({ onComplete, registerSave }) => {
  const account = useAuthStore((s) => s.account);
  const checkStatus = useAuthStore((s) => s.checkStatus);
  const thisDevice = useSyncStore((s) => s.thisDevice);
  const renameDevice = useSyncStore((s) => s.renameDevice);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [rules, setRules] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [editingDevice, setEditingDevice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from what we already know; only once, so typing is not overwritten.
  useEffect(() => {
    const [f, l] = splitName(account?.name);
    setFirst((v) => v || (settings.firstName as string) || f);
    setLast((v) => v || (settings.lastName as string) || l);
    setRules((v) => v || (settings.agentRules as string) || '');
    setDeviceName((v) => v || thisDevice?.name || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.name, thisDevice?.name, settings.firstName, settings.lastName, settings.agentRules]);

  const save = async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      await updateSettings({ firstName: first.trim(), lastName: last.trim(), agentRules: rules.trim() });
      if (deviceName.trim() && deviceName.trim() !== thisDevice?.name) {
        await renameDevice(deviceName.trim());
      }
      await checkStatus();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    registerSave?.(save);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, last, rules, deviceName, thisDevice?.name]);

  return (
    <div className="flex flex-col gap-5 text-left">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="First name" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" autoFocus />
        <Input label="Last name" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[var(--anchor-text-muted)]">This device</span>
        <div className="flex items-center gap-2 p-3 bg-[var(--anchor-surface-sunken)] rounded-lg border border-[var(--anchor-border)]">
          <Laptop className="w-4 h-4 text-[var(--anchor-accent)] shrink-0" />
          {editingDevice ? (
            <>
              <input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingDevice(false)}
                className="flex-1 bg-transparent text-sm text-[var(--anchor-text)] focus:outline-none"
                autoFocus
              />
              <Button size="xs" variant="outline" icon={<Check className="w-3 h-3" />} onClick={() => setEditingDevice(false)}>
                Done
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-[var(--anchor-text)] truncate">{deviceName || 'This device'}</span>
              <Button size="xs" variant="ghost" icon={<Pencil className="w-3 h-3" />} onClick={() => setEditingDevice(true)}>
                Change name
              </Button>
            </>
          )}
        </div>
        <p className="text-[11px] text-[var(--anchor-text-subtle)] leading-relaxed">
          Chats you start here belong to this device: it decides whether they sync and is the only one that can delete them from Google Drive.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[var(--anchor-text-muted)]">Standing instructions for the agent</span>
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder={RULES_PLACEHOLDER}
          rows={6}
          className="w-full resize-y rounded-lg border border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] px-3 py-2 text-sm text-[var(--anchor-text)] placeholder:text-[var(--anchor-text-subtle)] focus:outline-none focus:border-[var(--anchor-accent)] leading-relaxed"
        />
        <p className="text-[11px] text-[var(--anchor-text-subtle)] leading-relaxed">
          These are hard rules. The Antigravity agent follows them in every conversation, in Anchor and in your terminal, until you change them in Settings.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[var(--anchor-danger)]">
          {error}
        </p>
      )}

      {/* Fallback action when the wizard footer is not used (e.g. Settings embeds). */}
      {!registerSave && (
        <div>
          <Button variant="primary" size="sm" loading={saving} onClick={async () => (await save()) && onComplete()}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
};
