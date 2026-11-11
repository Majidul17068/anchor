import React, { useState } from 'react';
import { useSkillsStore } from '../../store/skills';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Download, Link } from 'lucide-react';

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose }) => {
  const [link, setLink] = useState('');
  const [importing, setImporting] = useState(false);
  const importFromLink = useSkillsStore((s) => s.importFromLink);

  const handleImport = async () => {
    if (!link.trim()) return;
    setImporting(true);
    try {
      await importFromLink(link.trim());
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import Skill from Share Link"
      description="Enter a verified Anchor skill share link to clone the skill definition into your library."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={importing}
            disabled={!link.trim()}
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleImport}
          >
            Import Skill
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-left">
        <Input
          label="Share Link URL"
          placeholder="https://anchor.app/share/skill/..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
          icon={<Link className="w-4 h-4" />}
        />
        <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">
          The skill files and evaluation benchmarks will be stored in your local repository and synced to your Google Drive AppData folder.
        </p>
      </div>
    </Dialog>
  );
};
