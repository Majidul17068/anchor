import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/settings';
import { useAuthStore } from '../../store/auth';
import { CliSection } from './CliSection';
import { AccountSection } from './AccountSection';
import { AppearanceSection } from './AppearanceSection';
import { ShortcutsSection } from './ShortcutsSection';
import { DangerZone } from './DangerZone';
import { Toast } from '../../components/Toast';

export const SettingsPage: React.FC = () => {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const checkStatus = useAuthStore((s) => s.checkStatus);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    checkStatus();
  }, [loadSettings, checkStatus]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left max-w-4xl mx-auto w-full">
      <div className="pb-2 border-b border-[var(--anchor-border)]">
        <h2 className="text-lg font-bold text-[var(--anchor-text)]">
          Anchor Desktop Settings
        </h2>
        <p className="text-xs text-[var(--anchor-text-muted)]">
          Manage Antigravity CLI daemon, Google AI credentials, appearance, and synchronization.
        </p>
      </div>

      <CliSection />
      <AccountSection />
      <AppearanceSection />
      <ShortcutsSection />
      <DangerZone onShowToast={setToastMessage} />

      {toastMessage && (
        <Toast
          message={toastMessage}
          type="info"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};
