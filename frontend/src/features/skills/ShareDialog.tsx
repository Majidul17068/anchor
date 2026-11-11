import React, { useState, useEffect } from 'react';
import type { Skill } from '../../bridge/types';
import { useSkillsStore } from '../../store/skills';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Badge } from '../../components/Badge';
import { Check, Copy, Link, ShieldAlert, Trash2, UserPlus, Users } from 'lucide-react';

export interface ShareDialogProps {
  skill: Skill;
  open: boolean;
  onClose: () => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ skill, open, onClose }) => {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'copy'>('view');
  const [shareLink, setShareLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const shareSkill = useSkillsStore((s) => s.shareSkill);
  const revokeSkill = useSkillsStore((s) => s.revokeSkill);
  const generateShareLink = useSkillsStore((s) => s.generateShareLink);

  useEffect(() => {
    if (open) {
      generateShareLink(skill.id).then(setShareLink);
    }
  }, [open, skill.id, generateShareLink]);

  const handleAddShare = async () => {
    if (!email.trim() || !email.includes('@')) return;
    await shareSkill(skill.id, email.trim(), permission);
    setEmail('');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Share Skill: ${skill.name}`}
      description="Collaborate and share your verified Antigravity skill definitions directly with other Google accounts."
      maxWidth="lg"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-5 text-left text-xs">
        {/* Important Google Account Plan Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--anchor-warn-subtle)] border border-[var(--anchor-warn)]/30 text-[var(--anchor-text)]">
          <ShieldAlert className="w-4 h-4 text-[var(--anchor-warn)] shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong>Google Account Requirement:</strong> Recipients must sign into Anchor with their Google account. Note: Anchor cannot verify peer AI subscription tiers (Google AI Pro or Ultra).
          </div>
        </div>

        {/* Share via Link */}
        <div className="space-y-1.5">
          <span className="font-semibold text-[var(--anchor-text)] block">
            Google Drive Direct Share Link
          </span>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={shareLink}
              icon={<Link className="w-3.5 h-3.5" />}
              className="font-mono text-[11px]"
            />
            <Button
              size="sm"
              variant="outline"
              icon={copiedLink ? <Check className="w-3.5 h-3.5 text-[var(--anchor-ok)]" /> : <Copy className="w-3.5 h-3.5" />}
              onClick={handleCopyLink}
            >
              {copiedLink ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* Invite by Email */}
        <div className="space-y-2 pt-2 border-t border-[var(--anchor-border-subtle)]">
          <span className="font-semibold text-[var(--anchor-text)] block">
            Invite Specific Google Account
          </span>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder="colleague@google.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="w-28">
              <Select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'view' | 'copy')}
                options={[
                  { value: 'view', label: 'Can View' },
                  { value: 'copy', label: 'Can Copy' },
                ]}
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={!email.trim()}
              icon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={handleAddShare}
            >
              Share
            </Button>
          </div>
        </div>

        {/* People with access list */}
        <div className="space-y-2 pt-2 border-t border-[var(--anchor-border-subtle)]">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--anchor-text)]">
            <Users className="w-3.5 h-3.5 text-[var(--anchor-accent)]" />
            <span>People With Access ({skill.sharedWith.length})</span>
          </div>

          {skill.sharedWith.length === 0 ? (
            <div className="p-3 rounded-lg bg-[var(--anchor-surface-sunken)] text-[var(--anchor-text-subtle)] text-[11px]">
              This skill has not been explicitly shared with anyone yet.
            </div>
          ) : (
            <div className="divide-y divide-[var(--anchor-border-subtle)] border border-[var(--anchor-border)] rounded-lg overflow-hidden bg-[var(--anchor-surface)]">
              {skill.sharedWith.map((sh) => (
                <div key={sh.email} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--anchor-text)]">{sh.email}</span>
                    <span className="text-[10px] text-[var(--anchor-text-subtle)]">
                      Shared on {new Date(sh.sharedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sh.permission === 'copy' ? 'accent' : 'default'} size="xs">
                      {sh.permission === 'copy' ? 'Can Copy' : 'View Only'}
                    </Badge>
                    <button
                      onClick={() => revokeSkill(skill.id, sh.email)}
                      aria-label={`Revoke access for ${sh.email}`}
                      className="p-1 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-danger)] rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
