import React, { useState } from 'react';
import { useMarketStore } from '../../store/market';
import { RequestCard } from './RequestCard';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Dialog } from '../../components/Dialog';
import { Tabs } from '../../components/Tabs';
import { Plus } from 'lucide-react';

export const RequestsTab: React.FC = () => {
  const requests = useMarketStore((s) => s.requests);
  const requestsFilter = useMarketStore((s) => s.requestsFilter);
  const setRequestsFilter = useMarketStore((s) => s.setRequestsFilter);
  const createRequest = useMarketStore((s) => s.createRequest);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bounty, setBounty] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) return;
    setCreating(true);
    try {
      await createRequest({
        title: title.trim(),
        description: description.trim(),
        bounty: bounty.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setBounty('');
      setDialogOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const filterTabs = [
    { id: 'all', label: 'All Community Requests' },
    { id: 'to_me', label: 'Requested from Me', count: requests.filter((r) => r.toAuthor?.id === 'auth_majidul').length },
    { id: 'mine', label: 'My Requests' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--anchor-border)]">
        <Tabs
          tabs={filterTabs}
          activeId={requestsFilter}
          onChange={(id) => setRequestsFilter(id as any)}
          variant="pills"
        />

        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setDialogOpen(true)}
        >
          Post Request
        </Button>
      </div>

      <div className="space-y-3">
        {requests.map((req) => (
          <RequestCard
            key={req.id}
            request={req}
            isRequester={req.requester.id === 'auth_majidul'}
          />
        ))}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Post a Skill Request"
        description="Ask the Anchor community or a specific author to author an Antigravity skill for your workflow."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={creating}
              disabled={!title.trim() || !description.trim()}
              onClick={handleCreate}
            >
              Post Request
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-left text-xs">
          <Input
            label="What skill do you need?"
            placeholder="e.g. Bun test runner with mocked WebSocket servers"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div>
            <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1">
              Problem Description & Expected Output
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the tools, APIs, and edge cases you want the agent to handle..."
              className="w-full bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-lg p-2.5 text-xs text-[var(--anchor-text)] focus:outline-none"
            />
          </div>

          <Input
            label="Community Bounty / Recognition (Optional)"
            placeholder="e.g. 500 Credits, Anchor Pro Sponsor, Eternal Gratitude"
            value={bounty}
            onChange={(e) => setBounty(e.target.value)}
          />
        </div>
      </Dialog>
    </div>
  );
};
