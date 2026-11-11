import React, { useState } from 'react';
import type { Agent, Effort, Model, Skill } from '../../bridge/types';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Dialog } from '../../components/Dialog';
import { confirmDialog } from '../../store/confirm';
import { Check, Trash2 } from 'lucide-react';

export interface AgentEditorProps {
  agent?: Agent | null;
  models: Model[];
  skills: Skill[];
  onSave: (agent: Omit<Agent, 'id' | 'source'> & { id?: string }) => Promise<Agent | void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

export const AgentEditor: React.FC<AgentEditorProps> = ({
  agent,
  models,
  skills,
  onSave,
  onDelete,
  onClose,
}) => {
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [instructions, setInstructions] = useState(agent?.instructions || '');
  const [modelId, setModelId] = useState(agent?.modelId || 'gemini-4-argon');
  const [effort, setEffort] = useState<Effort>(agent?.effort || 'medium');
  const [selectedTools, setSelectedTools] = useState<string[]>(
    agent?.tools || ['bash', 'read_file', 'write_file']
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>(agent?.skillIds || []);
  const [selectedMcp, setSelectedMcp] = useState<string[]>(agent?.mcpServers || ['mcp_filesystem']);
  const [saving, setSaving] = useState(false);

  const availableTools = [
    'bash',
    'read_file',
    'write_file',
    'grep_search',
    'browser',
    'node_test',
    'diff_editor',
    'web_search',
    'diagram_mermaid',
  ];

  const availableMcp = [
    'mcp_filesystem',
    'mcp_git',
    'mcp_docker',
    'mcp_google_search',
    'mcp_node',
  ];

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  };

  const toggleMcp = (mcp: string) => {
    setSelectedMcp((prev) =>
      prev.includes(mcp) ? prev.filter((m) => m !== mcp) : [...prev, mcp]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: agent?.id,
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        modelId,
        effort,
        tools: selectedTools,
        skillIds: selectedSkills,
        mcpServers: selectedMcp,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={agent ? `Edit Agent: ${agent.name}` : 'Create New Agent Persona'}
      description="Define system instructions, tool capabilities, and attached skills for the Antigravity agent."
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {agent && onDelete && (
              <Button
                variant="danger"
                size="xs"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: `Delete agent "${agent.name}"?`,
                    message: 'Removes its definition from ~/.gemini/config/agents. Sessions that used it are kept.',
                    confirmLabel: 'Delete',
                    danger: true,
                  });
                  if (ok) {
                    await onDelete(agent.id);
                    onClose();
                  }
                }}
              >
                Delete Agent
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!name.trim()}
              icon={<Check className="w-4 h-4" />}
              onClick={handleSave}
            >
              Save Agent
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-left">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Agent Name"
            placeholder="e.g. Senior Security Auditor"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Default Model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              options={models.map((m) => ({ value: m.id, label: m.label }))}
            />

            <Select
              label="Reasoning Effort"
              value={effort}
              onChange={(e) => setEffort(e.target.value as Effort)}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'xhigh', label: 'X-High' },
                { value: 'max', label: 'Max' },
              ]}
            />
          </div>
        </div>

        <Input
          label="One-line Description"
          placeholder="Brief description of when to employ this agent"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1">
            System Instructions (Markdown)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            placeholder="Provide strict behavioral directives, output formatting rules, and guidelines..."
            className="w-full bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-lg p-2.5 text-xs text-[var(--anchor-text)] font-mono leading-relaxed focus:border-[var(--anchor-border-focus)] focus:outline-none"
          />
        </div>

        {/* Tools Matrix */}
        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1.5">
            Allowed CLI Tools
          </label>
          <div className="grid grid-cols-3 gap-2">
            {availableTools.map((t) => {
              const active = selectedTools.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTool(t)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--anchor-accent)]/15 border-[var(--anchor-accent)] text-[var(--anchor-accent)] font-semibold'
                      : 'bg-[var(--anchor-surface-sunken)] border-[var(--anchor-border)] text-[var(--anchor-text-subtle)] hover:bg-[var(--anchor-surface-hover)]'
                  }`}
                >
                  <span>{t}</span>
                  {active && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Attached Skills */}
        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1.5">
            Attached Skills
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 border border-[var(--anchor-border)] rounded-lg bg-[var(--anchor-surface-sunken)]">
            {skills.map((sk) => {
              const active = selectedSkills.includes(sk.id);
              return (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => toggleSkill(sk.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--anchor-info)]/15 border-[var(--anchor-info)] text-[var(--anchor-info)] font-semibold'
                      : 'bg-[var(--anchor-surface)] border-[var(--anchor-border)] text-[var(--anchor-text-muted)] hover:bg-[var(--anchor-surface-hover)]'
                  }`}
                >
                  <span className="truncate">{sk.name}</span>
                  {active && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* MCP Servers */}
        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1.5">
            Connected MCP Context Servers
          </label>
          <div className="flex flex-wrap gap-2">
            {availableMcp.map((m) => {
              const active = selectedMcp.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMcp(m)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer border ${
                    active
                      ? 'bg-[var(--anchor-warn)]/15 border-[var(--anchor-warn)] text-[var(--anchor-warn)] font-semibold'
                      : 'bg-[var(--anchor-surface-sunken)] border-[var(--anchor-border)] text-[var(--anchor-text-subtle)]'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
