import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/settings';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { Check, HardDrive } from 'lucide-react';

/**
 * The Google OAuth client that identifies Anchor to Drive. A release built
 * with the ANCHOR_GOOGLE_CLIENT_* secrets carries one; otherwise it can be
 * pasted here (docs/DRIVE_SETUP.md explains how to create it).
 */
export const DriveClientSection: React.FC<{ onShowToast?: (msg: string) => void }> = ({ onShowToast }) => {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setClientId((settings.driveClientId as string) || '');
    setClientSecret((settings.driveClientSecret as string) || '');
  }, [settings.driveClientId, settings.driveClientSecret]);

  const configured = Boolean(settings.driveConfigured);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ driveClientId: clientId.trim(), driveClientSecret: clientSecret.trim() });
      onShowToast?.('Google Drive client saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--anchor-border-subtle)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-info)]">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--anchor-text)]">Google Drive OAuth client</h3>
            <p className="text-xs text-[var(--anchor-text-muted)]">
              Identifies Anchor to Google when you connect Drive. Users still sign in with their own account.
            </p>
          </div>
        </div>
        <Badge variant={configured ? 'ok' : 'warn'} size="xs" className="uppercase font-mono tracking-wider">
          {configured ? 'Configured' : 'Missing'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="Client ID"
          placeholder="1234567890-abc.apps.googleusercontent.com"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <Input
          label="Client secret"
          type="password"
          placeholder="GOCSPX-…"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--anchor-text-subtle)]">
          Create a <span className="font-mono">Desktop app</span> OAuth client in Google Cloud Console with the Drive API enabled; see docs/DRIVE_SETUP.md.
        </p>
        <Button size="sm" variant="primary" loading={saving} icon={<Check className="w-3.5 h-3.5" />} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
};
