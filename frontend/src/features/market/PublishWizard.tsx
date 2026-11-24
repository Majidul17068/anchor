import React, { useEffect, useState } from 'react';
import type { Agent, ListingKind, PluginInfo, Skill } from '../../bridge/types';
import { useMarketStore } from '../../store/market';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Tabs } from '../../components/Tabs';
import { CheckCircle2, ShieldCheck, Upload, XCircle } from 'lucide-react';

export interface PublishWizardProps {
  skills: Skill[];
  /** Your agents; only `source === 'mine'` can be shared. */
  agents?: Agent[];
  /** Plugins installed in the CLI. */
  plugins?: PluginInfo[];
  /** Preselect what to publish (from an agent card's Share button, for instance). */
  initial?: { kind: ListingKind; id: string };
  open: boolean;
  onClose: () => void;
}

const KIND_LABEL: Record<ListingKind, string> = { skill: 'Skill', agent: 'Agent', plugin: 'Plugin' };

export const PublishWizard: React.FC<PublishWizardProps> = ({ skills, agents = [], plugins = [], initial, open, onClose }) => {
  const mineSkills = skills.filter((s) => s.source === 'mine');
  const mineAgents = agents.filter((a) => a.source === 'mine');

  const [kind, setKind] = useState<ListingKind>(initial?.kind ?? 'skill');
  const [selectedId, setSelectedId] = useState<string>(initial?.id ?? mineSkills[0]?.id ?? '');
  const [listingName, setListingName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Coding']);
  const [visibility, setVisibility] = useState<'public' | 'unlisted'>('public');
  const [license, setLicense] = useState('MIT');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishListing = useMarketStore((s) => s.publishListing);

  const targetSkill = kind === 'skill' ? skills.find((s) => s.id === selectedId) : undefined;
  const targetAgent = kind === 'agent' ? mineAgents.find((a) => a.id === selectedId) : undefined;
  const targetPlugin = kind === 'plugin' ? plugins.find((p) => p.name === selectedId) : undefined;

  // Prefill the listing from whatever is selected.
  const prefill = (k: ListingKind, id: string) => {
    if (k === 'skill') {
      const sk = skills.find((s) => s.id === id);
      if (sk) {
        setListingName(sk.name);
        setTagline(sk.description);
        setDescription(sk.description + '\n\nFull technical guidelines for the Antigravity agent.');
      }
    } else if (k === 'agent') {
      const ag = mineAgents.find((a) => a.id === id);
      if (ag) {
        setListingName(ag.name);
        setTagline(ag.description);
        setDescription(`${ag.description}\n\nAgent definition for the Antigravity CLI (model ${ag.modelId}, ${ag.effort} effort${ag.tools.length ? `, tools: ${ag.tools.join(', ')}` : ''}).`);
      }
    } else {
      const pl = plugins.find((p) => p.name === id);
      if (pl) {
        setListingName(pl.displayName);
        setTagline(pl.description);
        setDescription(`${pl.description}\n\nAntigravity CLI plugin${pl.version ? ` v${pl.version}` : ''}: skills, agents and commands bundled together.`);
      }
    }
  };

  const firstIdFor = (k: ListingKind) =>
    k === 'skill' ? mineSkills[0]?.id ?? '' : k === 'agent' ? mineAgents[0]?.id ?? '' : plugins[0]?.name ?? '';

  useEffect(() => {
    if (initial) {
      setKind(initial.kind);
      setSelectedId(initial.id);
      prefill(initial.kind, initial.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.kind, initial?.id]);

  const changeKind = (k: ListingKind) => {
    setKind(k);
    const id = firstIdFor(k);
    setSelectedId(id);
    prefill(k, id);
  };

  const categories = ['Coding', 'Writing', 'Research', 'Data', 'DevOps', 'Design', 'Productivity', 'Other'];

  // Checklist criteria, by kind:
  const hasItem = Boolean(targetSkill || targetAgent || targetPlugin);
  const hasSpecFile =
    kind === 'skill'
      ? Boolean(targetSkill?.files.some((f) => f.path === 'SKILL.md'))
      : kind === 'agent'
        ? Boolean(targetAgent && targetAgent.instructions.trim().length > 0)
        : Boolean(targetPlugin);
  const hasMinDesc = description.trim().length >= 40;
  const hasExample = kind !== 'skill' || Boolean(targetSkill && targetSkill.examples.length >= 1);
  const agentVisible = kind !== 'agent' || targetAgent?.discovered !== false;

  const canPublish = hasItem && hasSpecFile && hasMinDesc && hasExample && agentVisible && listingName.trim() && tagline.trim();

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setError(null);
    try {
      await publishListing(kind, selectedId, {
        name: listingName.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        categories: selectedCategories,
        visibility,
        license,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  };

  const itemOptions =
    kind === 'skill'
      ? mineSkills.map((s) => ({ value: s.id, label: `${s.name} (v${s.version})` }))
      : kind === 'agent'
        ? mineAgents.map((a) => ({ value: a.id, label: `${a.name} · ${a.modelId}` }))
        : plugins.map((p) => ({ value: p.name, label: `${p.displayName}${p.version ? ` (v${p.version})` : ''}` }));

  const emptyHint =
    kind === 'skill'
      ? "You have no skills of your own yet. Create one on the Skills page under 'Mine'."
      : kind === 'agent'
        ? 'You have no agents of your own yet. Create one on the Agents page.'
        : 'No plugins are installed in the Antigravity CLI on this computer.';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Publish to Anchor Marketplace"
      description="Share a skill, an agent or a plugin of yours with every Anchor user."
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-[var(--anchor-text-subtle)] font-mono">
            Public catalog release · {KIND_LABEL[kind]}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={publishing}
              disabled={!canPublish}
              icon={<Upload className="w-3.5 h-3.5" />}
              onClick={handlePublish}
            >
              Publish {KIND_LABEL[kind]}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-left text-xs">
        {/* What to share */}
        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1.5">What do you want to share?</label>
          <Tabs
            tabs={[
              { id: 'skill', label: 'Skill', count: mineSkills.length },
              { id: 'agent', label: 'Agent', count: mineAgents.length },
              { id: 'plugin', label: 'Plugin', count: plugins.length },
            ]}
            activeId={kind}
            onChange={(id) => changeKind(id as ListingKind)}
            variant="pills"
          />
        </div>

        {itemOptions.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-[var(--anchor-border)] text-[var(--anchor-text-subtle)]">{emptyHint}</div>
        ) : (
          <Select
            label={kind === 'skill' ? "Select Skill from 'Mine'" : kind === 'agent' ? 'Select one of your agents' : 'Select an installed plugin'}
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              prefill(kind, e.target.value);
            }}
            options={itemOptions}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Listing Title"
            placeholder={kind === 'agent' ? 'e.g. Paper Reviewer' : kind === 'plugin' ? 'e.g. Team Tools' : 'e.g. React 19 Clean Modernizer'}
            value={listingName}
            onChange={(e) => setListingName(e.target.value)}
          />
          <Input
            label="One-line Tagline"
            placeholder="Concise value proposition for card display"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1">
            Detailed Description (Min 40 characters)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={
              kind === 'agent'
                ? 'Explain what the agent is for, how it behaves and which tools it uses...'
                : kind === 'plugin'
                  ? 'Explain what the plugin bundles (skills, agents, commands) and when to use it...'
                  : 'Explain what the skill accomplishes, input/output structures, and prerequisites...'
            }
            className="w-full bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-lg p-2.5 text-xs text-[var(--anchor-text)] focus:outline-none"
          />
          <span className="text-[10px] text-[var(--anchor-text-subtle)] block mt-0.5">
            {description.trim().length} / 40 characters
          </span>
        </div>

        {/* Categories */}
        <div>
          <label className="text-xs font-medium text-[var(--anchor-text-muted)] block mb-1.5">Categories</label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const active = selectedCategories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--anchor-accent)] text-white border-[var(--anchor-accent)]'
                      : 'bg-[var(--anchor-surface-sunken)] border-[var(--anchor-border)] text-[var(--anchor-text-muted)] hover:bg-[var(--anchor-surface-hover)]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as any)}
            options={[
              { value: 'public', label: 'Public (Searchable in catalog)' },
              { value: 'unlisted', label: 'Unlisted (Link only)' },
            ]}
          />
          <Select
            label="Software License"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            options={[
              { value: 'MIT', label: 'MIT License' },
              { value: 'Apache-2.0', label: 'Apache 2.0' },
              { value: 'GPL-3.0', label: 'GPL 3.0' },
            ]}
          />
        </div>

        {/* Pre-publication validation checklist */}
        <div className="p-3.5 bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-xl space-y-2">
          <span className="font-semibold text-xs text-[var(--anchor-text)] block">Publication Integrity Checklist</span>
          <div className="space-y-1.5 text-[11px]">
            <Check ok={hasSpecFile}>
              {kind === 'skill'
                ? 'SKILL.md specification file is present'
                : kind === 'agent'
                  ? 'Agent definition has instructions'
                  : 'plugin.json manifest is present'}
            </Check>
            <Check ok={hasMinDesc}>Comprehensive description ≥ 40 characters</Check>
            {kind === 'skill' && <Check ok={hasExample}>At least 1 verified evaluation example prompt provided</Check>}
            {kind === 'agent' && <Check ok={agentVisible}>The Antigravity CLI lists this agent (it runs with --agent)</Check>}
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--anchor-ok)]" />
              <span>Automated secret scanner runs on publish: API keys or tokens block the submission</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-[var(--anchor-danger)]/10 text-[11px] text-[var(--anchor-danger)]">{error}</div>
        )}
      </div>
    </Dialog>
  );
};

const Check: React.FC<{ ok: boolean; children: React.ReactNode }> = ({ ok, children }) => (
  <div className="flex items-center gap-2">
    {ok ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--anchor-ok)]" />
    ) : (
      <XCircle className="w-3.5 h-3.5 text-[var(--anchor-danger)]" />
    )}
    <span>{children}</span>
  </div>
);
