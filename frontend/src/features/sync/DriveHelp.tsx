import React, { useEffect, useState } from 'react';
import { useSyncStore } from '../../store/sync';
import { getBridge } from '../../bridge';
import { Button } from '../../components/Button';
import { Cloud, Download, ExternalLink, FolderSearch, RefreshCw } from 'lucide-react';

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

/** Splits "DRIVE_CODE: message" into its parts. */
function parse(error: string): { code: string; message: string } {
  const m = /^(DRIVE_[A-Z_]+):\s*(.*)$/s.exec(error);
  return m ? { code: m[1], message: m[2] } : { code: '', message: error };
}

/**
 * What to do when Google Drive cannot be used on this machine. Rendered
 * under the Connect button in onboarding and on the Sync page, and under
 * the status card when a connected folder stops answering.
 */
export const DriveHelp: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => {
  const chooseFolder = useSyncStore((s) => s.chooseFolder);
  const useFolder = useSyncStore((s) => s.useFolder);
  const candidates = useSyncStore((s) => s.candidates);
  const loadCandidates = useSyncStore((s) => s.loadCandidates);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const [opening, setOpening] = useState(false);

  const { code, message } = parse(error);
  const notFound = code === 'DRIVE_NOT_FOUND';
  const clientMissing = code === 'DRIVE_CLIENT_MISSING';
  const clientDown = code === 'DRIVE_CLIENT_NOT_RUNNING' || code === 'DRIVE_UNREACHABLE';

  useEffect(() => {
    if (notFound || clientMissing || clientDown) loadCandidates();
  }, [notFound, clientMissing, clientDown, loadCandidates]);

  const others = candidates.filter((c) => c.kind !== 'google-drive' && c.reachable !== false);

  const openClient = async () => {
    setOpening(true);
    try {
      await getBridge().sync.openDriveClient?.();
      // Drive needs a moment to mount its folder before Connect can succeed.
      await new Promise((r) => setTimeout(r, 6000));
      onRetry?.();
    } finally {
      setOpening(false);
    }
  };

  const alternatives = (
    <>
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
    </>
  );

  if (clientDown) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-xs text-[var(--anchor-warn)] leading-relaxed">
          {message || 'Google Drive for Desktop is not running, so its folder does not respond.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="primary" loading={opening} icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={openClient}>
            Open Google Drive
          </Button>
          {onRetry && (
            <Button size="xs" variant="outline" loading={isSyncing} icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onRetry}>
              Try again
            </Button>
          )}
          {alternatives}
        </div>
      </div>
    );
  }

  if (notFound || clientMissing) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-xs text-[var(--anchor-danger)] leading-relaxed">
          {clientMissing
            ? message
            : 'Google Drive for Desktop was not found on this computer. Install it and sign in with your Google account (free, uses your 15 GB Drive), then click Connect again.'}
          {others.length > 0 && ' Or use another cloud folder already on this computer:'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="outline" icon={<Download className="w-3.5 h-3.5" />} onClick={() => getBridge().system.openExternal(DRIVE_DOWNLOAD)}>
            Get Google Drive for Desktop
          </Button>
          {onRetry && (
            <Button size="xs" variant="ghost" loading={isSyncing} icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onRetry}>
              Connect again
            </Button>
          )}
          {alternatives}
        </div>
      </div>
    );
  }
  if (code === 'DRIVE_NOT_CONFIGURED') {
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
