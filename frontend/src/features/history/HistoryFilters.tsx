import React from 'react';
import type { Device, Agent, Project } from '../../bridge/types';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Search } from 'lucide-react';

export interface HistoryFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedDevice: string;
  onDeviceChange: (dev: string) => void;
  selectedAgent: string;
  onAgentChange: (ag: string) => void;
  selectedProject: string;
  onProjectChange: (proj: string) => void;
  selectedSync: string;
  onSyncChange: (sync: string) => void;
  devices: Device[];
  agents: Agent[];
  projects: Project[];
}

export const HistoryFilters: React.FC<HistoryFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedDevice,
  onDeviceChange,
  selectedAgent,
  onAgentChange,
  selectedProject,
  onProjectChange,
  selectedSync,
  onSyncChange,
  devices,
  agents,
  projects,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-[var(--anchor-surface)] border-b border-[var(--anchor-border)] text-left select-none">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Search conversation transcripts, titles, or code..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          icon={<Search className="w-4 h-4" />}
          className="text-xs"
        />
      </div>

      <div className="w-36">
        <Select
          aria-label="Filter by Device"
          value={selectedDevice}
          onChange={(e) => onDeviceChange(e.target.value)}
          className="text-xs py-1.5"
          options={[
            { value: '', label: 'All Devices' },
            ...devices.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
      </div>

      <div className="w-36">
        <Select
          aria-label="Filter by Agent"
          value={selectedAgent}
          onChange={(e) => onAgentChange(e.target.value)}
          className="text-xs py-1.5"
          options={[
            { value: '', label: 'All Agents' },
            ...agents.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      </div>

      <div className="w-36">
        <Select
          aria-label="Filter by Project"
          value={selectedProject}
          onChange={(e) => onProjectChange(e.target.value)}
          className="text-xs py-1.5"
          options={[
            { value: '', label: 'All Projects' },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </div>

      <div className="w-32">
        <Select
          aria-label="Filter by Sync State"
          value={selectedSync}
          onChange={(e) => onSyncChange(e.target.value)}
          className="text-xs py-1.5"
          options={[
            { value: '', label: 'All Sync States' },
            { value: 'synced', label: 'Synced to Drive' },
            { value: 'local', label: 'Local Only' },
          ]}
        />
      </div>
    </div>
  );
};
