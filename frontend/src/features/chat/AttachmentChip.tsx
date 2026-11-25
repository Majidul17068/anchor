import React, { useEffect, useState } from 'react';
import type { Attachment } from '../../bridge/types';
import { getBridge } from '../../bridge';
import { formatBytes } from '../../lib/format';
import { FileText, X } from 'lucide-react';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
export const isImage = (a: Attachment) => a.mime.startsWith('image/') || IMAGE_EXT.test(a.name) || IMAGE_EXT.test(a.path);

// One read per file per run; thumbnails are shown in the composer and again
// in the sent bubble.
const previews = new Map<string, Promise<string>>();
function loadPreview(path: string): Promise<string> {
  let p = previews.get(path);
  if (!p) {
    p = getBridge().system.imagePreview(path);
    p.catch(() => previews.delete(path));
    previews.set(path, p);
  }
  return p;
}

export interface AttachmentChipProps {
  attachment: Attachment;
  /** Shows a remove button (composer). */
  onRemove?: () => void;
}

/**
 * One attached file. Pictures show as a thumbnail that opens full size on
 * click; everything else as a name-and-size pill.
 */
export const AttachmentChip: React.FC<AttachmentChipProps> = ({ attachment, onRemove }) => {
  const image = isImage(attachment);
  const [src, setSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!image) return;
    let alive = true;
    loadPreview(attachment.path)
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [image, attachment.path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const remove = onRemove && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label={`Remove attachment ${attachment.name}`}
      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-danger)] flex items-center justify-center shadow-xs"
    >
      <X className="w-2.5 h-2.5" />
    </button>
  );

  if (image && src) {
    return (
      <>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(true)}
            title={`${attachment.name} (${formatBytes(attachment.size)})`}
            className="block rounded-lg overflow-hidden border border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] hover:border-[var(--anchor-border-focus)] cursor-zoom-in"
          >
            <img src={src} alt={attachment.name} className="h-16 max-w-[160px] object-cover block" />
          </button>
          {remove}
        </div>
        {open && (
          <div
            role="dialog"
            aria-label={attachment.name}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-8 cursor-zoom-out"
          >
            <img src={src} alt={attachment.name} className="max-w-full max-h-full rounded-lg shadow-lg" />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--anchor-surface)] border border-[var(--anchor-border)] text-[11px] text-[var(--anchor-text)] shadow-xs">
      <FileText className="w-3.5 h-3.5 text-[var(--anchor-text-subtle)] shrink-0" />
      <span className="font-medium truncate max-w-[150px]">{attachment.name}</span>
      <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">({formatBytes(attachment.size)})</span>
      {remove}
    </div>
  );
};
