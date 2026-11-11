import React, { useState } from 'react';
import { useSkillsStore } from '../../store/skills';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Download, Github, Link } from 'lucide-react';

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

/** `owner/repo`, a github.com URL (optionally /tree/<ref>/<path>), or an SSH remote. */
export function looksLikeGitHub(s: string): boolean {
  const v = s.trim();
  if (/github\.com[/:]/i.test(v)) return true;
  return /^[\w.-]+\/[\w.-]+$/.test(v);
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose }) => {
  const [link, setLink] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const importFromLink = useSkillsStore((s) => s.importFromLink);
  const importFromGitHub = useSkillsStore((s) => s.importFromGitHub);

  const isGitHub = looksLikeGitHub(link);

  const handleImport = async () => {
    const v = link.trim();
    if (!v) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      if (isGitHub) {
        const r = await importFromGitHub(v);
        const names = r.skills.map((s) => s.name);
        const parts: string[] = [];
        if (r.plugin) {
          parts.push(`Installed plugin "${r.plugin}" through the Antigravity CLI with ${names.length} skill${names.length === 1 ? '' : 's'}.`);
          if (r.linkedSkills?.length) parts.push(`Exposed to the CLI: ${r.linkedSkills.join(', ')}.`);
          if (r.fixedAgents?.length) parts.push(`Adapted agent frontmatter: ${r.fixedAgents.join(', ')}.`);
        } else if (names.length === 1) {
          parts.push(`Installed "${names[0]}".`);
        } else {
          parts.push(`Installed ${names.length} skills: ${names.join(', ')}.`);
        }
        if (r.notes?.length) parts.push(r.notes.join(' '));
        setResult(parts.join(' '));
        setLink('');
      } else {
        await importFromLink(v);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const close = () => {
    setError(null);
    setResult(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Adapt Skill"
      description="Paste a GitHub repository or an Anchor share link. A Claude Code or Antigravity plugin is installed through the CLI and fixed up; every folder holding a SKILL.md becomes a skill; a repository with neither becomes one skill built from its README."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={close}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={importing}
            disabled={!link.trim()}
            icon={isGitHub ? <Github className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            onClick={handleImport}
          >
            {isGitHub ? 'Adapt from GitHub' : 'Import Skill'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-left">
        <Input
          label="GitHub repository or share link"
          placeholder="owner/repo, https://github.com/owner/repo/tree/main/skills, or a share link"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleImport()}
          icon={isGitHub ? <Github className="w-4 h-4" /> : <Link className="w-4 h-4" />}
          error={error ?? undefined}
        />
        {result && (
          <p className="text-xs text-[var(--anchor-ok)] leading-relaxed">{result}</p>
        )}
        <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">
          Public repositories only. Plugins land in <span className="font-mono">~/.gemini/config/plugins</span> and skills in <span className="font-mono">~/.gemini/config/skills</span>, where the Antigravity CLI discovers them; adapting the same repository again updates it in place.
        </p>
      </div>
    </Dialog>
  );
};
