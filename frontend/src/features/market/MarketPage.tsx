import React, { useEffect, useState } from 'react';
import type { Listing } from '../../bridge/types';
import { useMarketStore } from '../../store/market';
import { useSkillsStore } from '../../store/skills';
import { ListingCard } from './ListingCard';
import { ListingDetail } from './ListingDetail';
import { PublishWizard } from './PublishWizard';
import { RequestsTab } from './RequestsTab';
import { MyMarketPanel } from './MyMarketPanel';
import { NotificationBell } from './NotificationBell';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { Tabs } from '../../components/Tabs';
import { PlanLock, useFeature } from '../../components/PlanGate';
import { Search, Sparkles, Upload } from 'lucide-react';
import { cn } from '../../lib/cn';

export const MarketPage: React.FC = () => {
  const listings = useMarketStore((s) => s.listings);
  const featuredListings = useMarketStore((s) => s.featuredListings);
  const activeListing = useMarketStore((s) => s.activeListing);
  const selectListing = useMarketStore((s) => s.selectListing);
  const categoryFilter = useMarketStore((s) => s.categoryFilter);
  const setCategoryFilter = useMarketStore((s) => s.setCategoryFilter);
  const sortOrder = useMarketStore((s) => s.sortOrder);
  const setSortOrder = useMarketStore((s) => s.setSortOrder);
  const searchQuery = useMarketStore((s) => s.searchQuery);
  const setSearchQuery = useMarketStore((s) => s.setSearchQuery);
  const activeTab = useMarketStore((s) => s.activeTab);
  const setActiveTab = useMarketStore((s) => s.setActiveTab);
  const loadCatalog = useMarketStore((s) => s.loadCatalog);

  const skills = useSkillsStore((s) => s.skills);
  const loadSkills = useSkillsStore((s) => s.loadSkills);

  const [selectedListingDetail, setSelectedListingDetail] = useState<Listing | null>(null);
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const { gate: gatePublish } = useFeature('market_publish');

  useEffect(() => {
    loadCatalog();
    loadSkills();
  }, [loadCatalog, loadSkills]);

  const categories = [
    'All',
    'Coding',
    'Writing',
    'Research',
    'Data',
    'DevOps',
    'Design',
    'Productivity',
    'Other',
  ];

  const mainTabs = [
    { id: 'catalog', label: 'Explore Catalog' },
    { id: 'requests', label: 'Requests & Bounties' },
    { id: 'my-market', label: 'My Marketplace' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[var(--anchor-bg)] overflow-hidden text-left">
      {/* Top Banner Navigation */}
      <div className="p-4 border-b border-[var(--anchor-border)] bg-[var(--anchor-surface)] flex flex-wrap items-center justify-between gap-4 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Tabs
            tabs={mainTabs}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as any)}
            variant="pills"
          />
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <PlanLock feature="market_publish" />
          <Button
            variant="primary"
            size="sm"
            icon={<Upload className="w-3.5 h-3.5" />}
            onClick={gatePublish(() => setPublishWizardOpen(true))}
          >
            Publish a Skill
          </Button>
        </div>
      </div>

      {activeTab === 'catalog' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Search bar & Sort Controls */}
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[280px]">
                <Input
                  placeholder="Search 24+ published Antigravity skills, author names, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={<Search className="w-4 h-4" />}
                />
              </div>

              <div className="w-48">
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  options={[
                    { value: 'trending', label: 'Trending First' },
                    { value: 'newest', label: 'Newest Releases' },
                    { value: 'installs', label: 'Most Installed' },
                    { value: 'rating', label: 'Top Rated' },
                  ]}
                />
              </div>
            </div>

            {/* Category Chips Bar */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {categories.map((cat) => {
                const isSelected = (cat === 'All' && !categoryFilter) || categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat === 'All' ? null : cat)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer select-none',
                      isSelected
                        ? 'bg-[var(--anchor-accent)] text-white border-[var(--anchor-accent)] shadow-xs font-semibold'
                        : 'bg-[var(--anchor-surface)] text-[var(--anchor-text-muted)] border-[var(--anchor-border)] hover:bg-[var(--anchor-surface-hover)]'
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Featured Row (when not filtering) */}
          {!categoryFilter && !searchQuery && featuredListings.length > 0 && (
            <div className="max-w-7xl mx-auto space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--anchor-accent)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
                  Featured Community Skills
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {featuredListings.map((l) => (
                  <ListingCard
                    key={`feat-${l.id}`}
                    listing={l}
                    onSelect={() => setSelectedListingDetail(l)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Catalog Grid */}
          <div className="max-w-7xl mx-auto space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
              All Public Listings ({listings.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {listings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  onSelect={() => setSelectedListingDetail(l)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requests' && <RequestsTab />}

      {activeTab === 'my-market' && <MyMarketPanel />}

      {/* Listing Detail Modal */}
      {selectedListingDetail && (
        <ListingDetail
          listing={selectedListingDetail}
          onClose={() => setSelectedListingDetail(null)}
        />
      )}

      {/* Publish Wizard Modal */}
      {publishWizardOpen && (
        <PublishWizard
          skills={skills}
          open={true}
          onClose={() => setPublishWizardOpen(false)}
        />
      )}
    </div>
  );
};
