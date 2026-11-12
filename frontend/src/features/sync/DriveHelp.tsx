import React from 'react';
import { useSyncStore } from '../../store/sync';
import { getBridge } from '../../bridge';
import { Button } from '../../components/Button';
import { Download, FolderSearch } from 'lucide-react';

const DRIVE_DOWNLOAD = 'https://www.google.com/drive/download/';

/**
 * What to do when Connect could not find Google Drive on this machine.
 * Rendered under the Connect button in onboarding and on the Sync page.
 */
export const DriveHelp: React.FC<{ error: string }> = ({ error }) => {
  const chooseFolder = useSyncStore((s) => s.chooseFolder);
  const isSyncing = useSyncStore((s) => s.isSyncing);

  if (error.startsWith('DRIVE_NOT_FOUND')) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-xs text-[var(--anchor-danger)] leading-relaxed">
          Google Drive for Desktop was not found on this computer. Install it and sign in with your Google account (it is free and uses your 15 GB Drive), then click Connect again. If you already keep a folder in sync with another cloud client, choose that folder instead.
        </p>
        <div className="flex items-center gap-2">
          <Button size="xs" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={() => getBridge().system.openExternal(DRIVE_DOWNLOAD)}>
            Get Google Drive for Desktop
          </Button>
          <Button size="xs" variant="ghost" loading={isSyncing} icon={<FolderSearch className="w-3.5 h-3.5" />} onClick={chooseFolder}>
            Choose a synced folder…
          </Button>
        </div>
      </div>
    );
  }
  if (error.startsWith('DRIVE_NOT_CONFIGURED')) {
    return (
      <p role="alert" className="text-xs text-[var(--anchor-danger)] leading-relaxed">
        This build has no Google OAuth client, so the Drive API cannot be used. Install Google Drive for Desktop and click Connect again, or add a client id under Settings → Google Drive OAuth client.
      </p>
    );
  }
  return (
    <p role="alert" className="text-xs text-[var(--anchor-danger)] leading-relaxed">
      {error}
    </p>
  );
};
