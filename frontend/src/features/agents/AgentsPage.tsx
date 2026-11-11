import React, { useEffect, useState } from 'react';
import type { Agent } from '../../bridge/types';
import { useAgentsStore } from '../../store/agents';
import { useSkillsStore } from '../../store/skills';
import { AgentCard } from './AgentCard';
import { AgentEditor } from './AgentEditor';
import { AgentTestPanel } from './AgentTestPanel';
import { Button } from '../../components/Button';
import { Tabs } from '../../components/Tabs';
import { Plus } from 'lucide-react';

export interface AgentsPageProps {
  onStartSessionWithAgent?: (agentId: string) => void;
}

export const AgentsPage: React.FC<AgentsPageProps> = () => {
  const agents = useAgentsStore((s) => s.agents);
  const models = useAgentsStore((s) => s.models);
  const activeAgent = useAgentsStore((s) => s.activeAgent);
  const selectAgent = useAgentsStore((s) => s.selectAgent);
  const saveAgent = useAgentsStore((s) => s.saveAgent);
  const deleteAgent = useAgentsStore((s) => s.deleteAgent);
  const loadAgents = useAgentsStore((s) => s.loadAgents);

  const skills = useSkillsStore((s) => s.skills);
  const loadSkills = useSkillsStore((s) => s.loadSkills);

  const [filterSource, setFilterSource] = useState<string>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [testAgent, setTestAgent] = useState<Agent | null>(null);

  useEffect(() => {
    loadAgents();
    loadSkills();
  }, [loadAgents, loadSkills]);

  const filteredAgents = agents.filter((ag) => {
    if (filterSource === 'all') return true;
    return ag.source === filterSource;
  });

  const handleCreateNew = () => {
    setEditingAgent(null);
    setEditorOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setEditorOpen(true);
  };

  const tabs = [
    { id: 'all', label: 'All Agents', count: agents.length },
    { id: 'mine', label: 'Mine', count: agents.filter((a) => a.source === 'mine').length },
    { id: 'builtin', label: 'Builtin', count: agents.filter((a) => a.source === 'builtin').length },
    { id: 'plugin', label: 'Plugins', count: agents.filter((a) => a.source === 'plugin').length },
    { id: 'shared', label: 'Shared', count: agents.filter((a) => a.source === 'shared').length },
  ];

  return (
    <div className="flex h-full w-full bg-[var(--anchor-bg)] overflow-hidden text-left">
      {/* Main List and Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header Action Bar */}
        <div className="p-4 border-b border-[var(--anchor-border)] bg-[var(--anchor-surface)] flex items-center justify-between gap-4 shrink-0 select-none">
          <Tabs
            tabs={tabs}
            activeId={filterSource}
            onChange={setFilterSource}
            variant="pills"
          />

          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleCreateNew}
          >
            Create Agent
          </Button>
        </div>

        {/* Agents Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl">
            {filteredAgents.map((ag) => (
              <AgentCard
                key={ag.id}
                agent={ag}
                isSelected={activeAgent?.id === ag.id}
                onSelect={() => selectAgent(ag.id)}
                onEdit={() => handleEdit(ag)}
                onTest={() => setTestAgent(ag)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Slideout Test Panel */}
      {testAgent && (
        <AgentTestPanel
          agent={testAgent}
          onClose={() => setTestAgent(null)}
        />
      )}

      {/* Create / Edit Dialog */}
      {editorOpen && (
        <AgentEditor
          agent={editingAgent}
          models={models}
          skills={skills}
          onSave={saveAgent}
          onDelete={deleteAgent}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
};
