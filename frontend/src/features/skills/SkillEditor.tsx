import React, { useState } from 'react';
import type { Skill, SkillFile, SkillExample } from '../../bridge/types';
import { SkillFileTree } from './SkillFileTree';
import { TrainPanel } from './TrainPanel';
import { PlanGate } from '../../components/PlanGate';
import { VersionList } from './VersionList';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Tabs } from '../../components/Tabs';
import { Check, Code, FileText, History, Sparkles, X } from 'lucide-react';

export interface SkillEditorProps {
  skill: Skill;
  onSave: (skill: Omit<Skill, 'id' | 'source' | 'sharedWith' | 'updatedAt'> & { id?: string }) => Promise<Skill>;
  onClose: () => void;
}

export const SkillEditor: React.FC<SkillEditorProps> = ({ skill, onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'train' | 'versions'>('editor');
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [version, setVersion] = useState(skill.version);
  const [triggersString, setTriggersString] = useState(skill.triggers.join(', '));
  const [files, setFiles] = useState<SkillFile[]>([...skill.files]);
  const [examples, setExamples] = useState<SkillExample[]>([...skill.examples]);
  const [activeFilePath, setActiveFilePath] = useState<string>(files[0]?.path || 'SKILL.md');
  const [saving, setSaving] = useState(false);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];

  const handleFileContentChange = (content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.path === activeFile?.path ? { ...f, content } : f))
    );
  };

  const handleAddFile = (path: string) => {
    if (files.some((f) => f.path === path)) {
      setActiveFilePath(path);
      return;
    }
    const newFile: SkillFile = { path, content: `# ${path}\n\nSupporting file content.` };
    setFiles((prev) => [...prev, newFile]);
    setActiveFilePath(path);
  };

  const handleDeleteFile = (path: string) => {
    const nextFiles = files.filter((f) => f.path !== path);
    setFiles(nextFiles);
    setActiveFilePath(nextFiles[0]?.path || 'SKILL.md');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedTriggers = triggersString
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await onSave({
        id: skill.id,
        name: name.trim(),
        description: description.trim(),
        version: version.trim(),
        author: skill.author,
        triggers: parsedTriggers,
        files,
        examples,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const editorTabs = [
    { id: 'editor', label: 'Files & Frontmatter', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'train', label: 'Evaluation & Training', icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />, count: examples.length },
    { id: 'versions', label: 'Version Revisions', icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-5xl h-[88vh] bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] rounded-2xl shadow-modal overflow-hidden flex flex-col text-left">
        {/* Top Header */}
        <div className="h-14 px-5 border-b border-[var(--anchor-border)] flex items-center justify-between bg-[var(--anchor-surface)] shrink-0 select-none">
          <div className="flex items-center gap-3">
            <Tabs
              tabs={editorTabs}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id as any)}
              variant="pills"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              icon={<Check className="w-4 h-4" />}
              onClick={handleSave}
            >
              Save Skill
            </Button>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-1 rounded text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] hover:bg-[var(--anchor-surface-hover)] ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab 1: Editor */}
        {activeTab === 'editor' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left File Tree */}
            <SkillFileTree
              files={files}
              activeFile={activeFile?.path || 'SKILL.md'}
              onSelectFile={setActiveFilePath}
              onAddFile={handleAddFile}
              onDeleteFile={handleDeleteFile}
            />

            {/* Right Editor Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--anchor-bg)]">
              {/* Frontmatter form for SKILL.md */}
              {activeFile?.path === 'SKILL.md' && (
                <div className="p-4 border-b border-[var(--anchor-border)] bg-[var(--anchor-surface)] grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
                  <Input
                    label="Skill Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    label="Version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                  <Input
                    label="Triggers (comma-separated)"
                    placeholder="e.g. e2e, test, playwright"
                    value={triggersString}
                    onChange={(e) => setTriggersString(e.target.value)}
                  />
                  <div className="md:col-span-3">
                    <Input
                      label="One-line Description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Code/Markdown text editor */}
              <div className="flex-1 flex flex-col overflow-hidden p-4">
                <div className="flex items-center justify-between pb-2 text-[11px] text-[var(--anchor-text-subtle)] font-mono">
                  <span>Editing: {activeFile?.path}</span>
                  <span>UTF-8 · Markdown/Text</span>
                </div>
                <textarea
                  value={activeFile?.content || ''}
                  onChange={(e) => handleFileContentChange(e.target.value)}
                  className="flex-1 w-full p-4 rounded-xl bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] text-xs text-[var(--anchor-text)] font-mono leading-relaxed resize-none focus:outline-none focus:border-[var(--anchor-border-focus)] selectable"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Train Panel */}
        {activeTab === 'train' && (
          <PlanGate feature="skill_train">
            <TrainPanel
              skill={{ ...skill, files, examples }}
              onUpdateExamples={setExamples}
            />
          </PlanGate>
        )}

        {/* Tab 3: Versions List */}
        {activeTab === 'versions' && (
          <VersionList
            skillId={skill.id}
            currentVersion={skill.version}
          />
        )}
      </div>
    </div>
  );
};
