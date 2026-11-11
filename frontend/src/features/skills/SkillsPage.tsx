import React, { useEffect, useState } from 'react';
import type { Skill } from '../../bridge/types';
import { useSkillsStore, type SkillTab } from '../../store/skills';
import { SkillCard } from './SkillCard';
import { SkillEditor } from './SkillEditor';
import { ShareDialog } from './ShareDialog';
import { ImportDialog } from './ImportDialog';
import { Button } from '../../components/Button';
import { Tabs } from '../../components/Tabs';
import { Download, Plus } from 'lucide-react';
import { createId } from '../../lib/ids';

export const SkillsPage: React.FC = () => {
  const skills = useSkillsStore((s) => s.skills);
  const activeSkill = useSkillsStore((s) => s.activeSkill);
  const activeTab = useSkillsStore((s) => s.activeTab);
  const setActiveTab = useSkillsStore((s) => s.setActiveTab);
  const loadSkills = useSkillsStore((s) => s.loadSkills);
  const selectSkill = useSkillsStore((s) => s.selectSkill);
  const saveSkill = useSkillsStore((s) => s.saveSkill);

  const [editorSkill, setEditorSkill] = useState<Skill | null>(null);
  const [shareSkillTarget, setShareSkillTarget] = useState<Skill | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Skill sections: Mine · Acquired · Shared with me · Plugins · Builtin
  const filteredSkills = skills.filter((sk) => {
    if (activeTab === 'mine') return sk.source === 'mine' && !sk.id.startsWith('skill_acquired');
    if (activeTab === 'acquired') return sk.id.startsWith('skill_acquired') || sk.author.includes('Fanclub');
    if (activeTab === 'shared') return sk.source === 'shared';
    if (activeTab === 'plugins') return sk.source === 'plugin';
    if (activeTab === 'builtin') return sk.source === 'builtin';
    return true;
  });

  const handleCreateNew = () => {
    const freshSkill: Skill = {
      id: createId('skill'),
      name: 'Custom Domain Specialist',
      description: 'Executes specialized tasks with domain-specific patterns and evaluation rules.',
      version: '0.1.0',
      author: 'Majidul Islam',
      source: 'mine',
      triggers: ['domain', 'specialist'],
      files: [
        {
          path: 'SKILL.md',
          content: `---
name: custom-specialist
description: Custom domain specialist
triggers: [domain, custom]
---
# Custom Specialist Guidelines
1. Validate inputs thoroughly.
2. Produce concise, testable code.`,
        },
      ],
      examples: [
        {
          id: createId('ex'),
          prompt: 'Execute initial validation test',
          expected: 'Passes assertions cleanly',
        },
      ],
      sharedWith: [],
      updatedAt: new Date().toISOString(),
    };
    setEditorSkill(freshSkill);
  };

  const tabs: { id: SkillTab; label: string; count?: number }[] = [
    { id: 'mine', label: 'Mine', count: skills.filter((s) => s.source === 'mine' && !s.id.startsWith('skill_acquired')).length },
    { id: 'acquired', label: 'Acquired', count: skills.filter((s) => s.id.startsWith('skill_acquired') || s.author.includes('Fanclub')).length },
    { id: 'shared', label: 'Shared with me', count: skills.filter((s) => s.source === 'shared').length },
    { id: 'plugins', label: 'Plugins', count: skills.filter((s) => s.source === 'plugin').length },
    { id: 'builtin', label: 'Builtin', count: skills.filter((s) => s.source === 'builtin').length },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[var(--anchor-bg)] overflow-hidden text-left">
      {/* Top Action Bar */}
      <div className="p-4 border-b border-[var(--anchor-border)] bg-[var(--anchor-surface)] flex items-center justify-between gap-4 shrink-0 select-none">
        <Tabs
          tabs={tabs}
          activeId={activeTab}
          onChange={(tab) => setActiveTab(tab as SkillTab)}
          variant="pills"
        />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={() => setImportDialogOpen(true)}
          >
            Adapt Skill
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleCreateNew}
          >
            Create Skill
          </Button>
        </div>
      </div>

      {/* Grid of skills */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl">
          {filteredSkills.map((sk) => (
            <SkillCard
              key={sk.id}
              skill={sk}
              isSelected={activeSkill?.id === sk.id}
              onSelect={() => selectSkill(sk.id)}
              onEdit={() => setEditorSkill(sk)}
              onShare={sk.source === 'mine' ? () => setShareSkillTarget(sk) : undefined}
              onTrain={() => setEditorSkill(sk)}
            />
          ))}
        </div>
      </div>

      {/* Full Editor Modal */}
      {editorSkill && (
        <SkillEditor
          skill={editorSkill}
          onSave={saveSkill}
          onClose={() => setEditorSkill(null)}
        />
      )}

      {/* Share Dialog */}
      {shareSkillTarget && (
        <ShareDialog
          skill={shareSkillTarget}
          open={true}
          onClose={() => setShareSkillTarget(null)}
        />
      )}

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
      />
    </div>
  );
};
