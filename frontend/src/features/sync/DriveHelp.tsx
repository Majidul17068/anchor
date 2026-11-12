import React, { useEffect } from 'react';
import { useSyncStore } from '../../store/sync';
import { getBridge } from '../../bridge';
import { Button } from '../../components/Button';
import { Cloud, Download, FolderSearch } from 'lucide-react';

const DRIVE_DOWNLOAD = 'https://www.google.com/drive/download/';

/** Human name for where a synced folder lives. */
export function folderKindLabel(kind?: string): string {
  switch (kind) {
    case 'google-drive':
      return 'Google Drive';
    case 'icloud':
      return 'iCloud Drive';
    case 'dropbox':
      return 'Dropbox';
    case 'onedrive':
      return 'OneDrive';
    default:
      return 'a synced folder';
  }
}

/**
 * What to do when Connect could not find Google Drive on this machine.
 * Rendered under the Connect button in onboarding and on the Sync page.
 */
export const DriveHelp: React.FC<{ error: string }> = ({ error }) => {
  const chooseFolder = useSyncStore((s) => s.chooseFolder);
  const useFolder = useSyncStore((s) => s.useFolder);
  const candidates = useSyncStore((s) => s.candidates);
  const loadCandidates = useSyncStore((s) => s.loadCandidates);
  const isSyncing = useSyncStore((s) => s.isSyncing);

  const notFound = error.startsWith('DRIVE_NOT_FOUND');
  useEffect(() => {
    if (notFound) loadCandidates();
  }, [notFound, loadCandidates]);

  if (notFound) {
    const others = candidates.filter((c) => c.kind !== 'google-drive');
    return (
      <div className="space-y-2">
        <p role="alert" className="text-xs text-[var(--anchor-danger)] leading-relaxed">
          Google Drive for Desktop was not found on this computer. Install it and sign in with your Google account (free, uses your 15 GB Drive), then click Connect again.
          {others.length > 0 && ' Or use another cloud folder already on this computer:'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={() => getBridge().system.openExternal(DRIVE_DOWNLOAD)}>
            Get Google Drive for Desktop
          </Button>
          {others.map((c) => (
            <Button
              key={c.path}
              size="xs"
              variant="outline"
              loading={isSyncing}
              icon={<Cloud className="w-3.5 h-3.5" />}
              title={c.path}
              onClick={() => useFolder(c.path)}
            >
              Use {c.label} instead
            </Button>
          ))}
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
