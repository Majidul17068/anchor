import React, { useEffect, useState } from 'react';
import type { Listing } from '../../bridge/types';
import { useMarketStore } from '../../store/market';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { MarkdownView } from '../../components/MarkdownView';
import { CodeBlock } from '../../components/CodeBlock';
import { Tabs } from '../../components/Tabs';
import { formatNumberCompact, formatRelativeDate } from '../../lib/format';
import {
  AlertCircle,
  Check,
  Download,
  Flag,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';

export interface ListingDetailProps {
  listing: Listing;
  onClose: () => void;
}

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing: opened, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'reviews' | 'changelog'>('overview');
  const [installing, setInstalling] = useState(false);
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [reported, setReported] = useState(false);
  const [updateRequested, setUpdateRequested] = useState(false);
  const [posting, setPosting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSent, setReviewSent] = useState(false);

  const installListing = useMarketStore((s) => s.installListing);
  const uninstallListing = useMarketStore((s) => s.uninstallListing);
  const addReview = useMarketStore((s) => s.addReview);
  // The store's copy is live (rating, install state); the prop is what was
  // clicked and covers the moment before the store has loaded it.
  const active = useMarketStore((s) => s.activeListing);
  const listing = active && active.id === opened.id ? active : opened;
  const allReviews = useMarketStore((s) => s.reviews);
  const reviews = allReviews.filter((r) => r.listingId === listing.id || !r.listingId);
  const myReview = reviews.find((r) => r.mine);

  // Editing an earlier review starts from it.
  useEffect(() => {
    if (myReview) {
      setNewReviewRating(myReview.rating);
      setNewReviewText(myReview.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReview?.id, myReview?.at]);

  const isInstalled = Boolean(listing.installedVersion);
  const hasUpdate = isInstalled && listing.installedVersion !== listing.version;
  const kind = listing.kind ?? 'skill';
  const kindLabel = kind === 'agent' ? 'Agent' : kind === 'plugin' ? 'Plugin' : 'Skill';
  const installLabel =
    kind === 'agent' ? 'Add to My Agents' : kind === 'plugin' ? 'Install Plugin' : 'Add to My Skills';

  const handleInstallToggle = async () => {
    setInstalling(true);
    try {
      if (isInstalled && !hasUpdate) {
        await uninstallListing(listing.id);
      } else {
        await installListing(listing.id);
      }
    } finally {
      setInstalling(false);
    }
  };

  const handlePostReview = async () => {
    if (!newReviewText.trim() || posting) return;
    setPosting(true);
    setReviewError(null);
    setReviewSent(false);
    try {
      await addReview(listing.id, newReviewRating, newReviewText.trim());
      setReviewSent(true);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setPosting(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'files', label: `Files (${listing.files.length})` },
    { id: 'reviews', label: `Reviews (${reviews.length})` },
    { id: 'changelog', label: 'Changelog' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl h-[88vh] bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] rounded-2xl shadow-modal overflow-hidden flex flex-col text-left">
        {/* Top Header */}
        <div className="p-6 border-b border-[var(--anchor-border)] bg-[var(--anchor-surface)] flex items-start justify-between gap-4 shrink-0 select-none">
          <div className="flex items-start gap-4">
            <Avatar name={listing.author.name} src={listing.author.avatarUrl} size="lg" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--anchor-text)]">
                  {listing.name}
                </h2>
                <Badge variant="accent" size="xs">v{listing.version}</Badge>
                {kind !== 'skill' && (
                  <Badge variant="info" size="xs">{kindLabel}</Badge>
                )}
                {listing.trained && (
                  <Badge variant="ok" size="xs">
                    <Sparkles className="w-3 h-3 mr-0.5 text-amber-400" />
                    Evaluation Verified
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[var(--anchor-text-muted)]">
                {listing.tagline}
              </p>
              <div className="flex items-center gap-4 text-[11px] text-[var(--anchor-text-subtle)] pt-1">
                <span>By <strong>{listing.author.name}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-400 font-semibold">
                  <Star className="w-3 h-3 fill-current" />
                  {listing.rating.toFixed(1)} ({listing.ratingCount} reviews)
                </span>
                <span>•</span>
                <span>{formatNumberCompact(listing.installs)} installs</span>
                <span>•</span>
                <span className="font-mono">{listing.license} License</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isInstalled && !hasUpdate ? 'outline' : 'primary'}
              size="md"
              loading={installing}
              icon={
                hasUpdate ? (
                  <RotateCcw className="w-4 h-4" />
                ) : isInstalled ? (
                  <Check className="w-4 h-4 text-[var(--anchor-ok)]" />
                ) : (
                  <Download className="w-4 h-4" />
                )
              }
              onClick={handleInstallToggle}
            >
              {hasUpdate ? `Update ${kindLabel}` : isInstalled ? 'Installed (Remove)' : installLabel}
            </Button>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-1 rounded text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] hover:bg-[var(--anchor-surface-hover)] ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="px-6 border-b border-[var(--anchor-border)] bg-[var(--anchor-surface)] shrink-0">
          <Tabs
            tabs={tabs}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as any)}
            variant="underline"
          />
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)] mb-2">
                  About this {kindLabel}
                </h4>
                <MarkdownView content={listing.description} />
              </div>

              {listing.examples.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)] mb-2">
                    Verified Example Prompts
                  </h4>
                  <div className="space-y-2">
                    {listing.examples.map((ex) => (
                      <div
                        key={ex.id}
                        className="p-3 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-lg text-xs space-y-1"
                      >
                        <span className="font-semibold text-[var(--anchor-text)] block">
                          &quot;{ex.prompt}&quot;
                        </span>
                        <span className="text-[11px] text-[var(--anchor-text-subtle)] font-mono block">
                          Expected: {ex.expected}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Utility actions: Request an update & Report */}
              <div className="pt-4 border-t border-[var(--anchor-border-subtle)] flex items-center gap-4 text-xs">
                <button
                  onClick={() => setUpdateRequested(true)}
                  className="flex items-center gap-1.5 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-accent)] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{updateRequested ? 'Update Requested!' : 'Request an update from author'}</span>
                </button>
                <button
                  onClick={() => setReported(true)}
                  className="flex items-center gap-1.5 text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-danger)] cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{reported ? 'Listing Reported' : 'Report listing'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="space-y-4 max-w-3xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
                {kind === 'agent' ? 'Agent definition file' : kind === 'plugin' ? 'Plugin files' : 'SKILL.md & Included Reference Assets'}
              </h4>
              {listing.files.map((file) => (
                <div key={file.path} className="space-y-1">
                  <span className="text-xs font-mono font-semibold text-[var(--anchor-text)]">
                    {file.path}
                  </span>
                  <CodeBlock code={file.content} language="markdown" />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6 max-w-3xl">
              {/* Write review */}
              <div className="p-4 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-xl space-y-3">
                <span className="text-xs font-semibold text-[var(--anchor-text)] block">
                  {myReview ? 'Update Your Review' : 'Write a Community Review'}
                </span>
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={star === newReviewRating}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      onClick={() => setNewReviewRating(star)}
                      className={`p-1 cursor-pointer ${star <= newReviewRating ? 'text-amber-400' : 'text-gray-600'}`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  ))}
                  <span className="pl-2 text-[11px] font-mono text-[var(--anchor-text-subtle)]">{newReviewRating} / 5</span>
                </div>
                <textarea
                  value={newReviewText}
                  onChange={(e) => setNewReviewText(e.target.value)}
                  placeholder="Share your experience using this skill with Google Antigravity..."
                  rows={2}
                  className="w-full bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-lg p-2.5 text-xs text-[var(--anchor-text)] focus:outline-none"
                />
                <Button size="xs" variant="primary" loading={posting} disabled={!newReviewText.trim()} onClick={handlePostReview}>
                  {myReview ? 'Update Review' : 'Submit Review'}
                </Button>
                {reviewError && (
                  <p className="text-[11px] text-[var(--anchor-danger)]">{reviewError}</p>
                )}
                {reviewSent && !reviewError && (
                  <p className="text-[11px] text-[var(--anchor-text-muted)]">
                    Saved. Your rating counts here right away. A GitHub page opened with the review filled in:
                    press <strong>Submit new issue</strong> there so everyone else sees it too.
                  </p>
                )}
              </div>

              {/* Reviews list */}
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar name={rev.author.name} src={rev.author.avatarUrl} size="xs" />
                        <span className="font-semibold text-[var(--anchor-text)]">{rev.author.name}</span>
                        {rev.mine && <Badge variant="accent" size="xs">You</Badge>}
                        {rev.pending && (
                          <span title="Saved on this device and submitted; it appears for everyone once it is added to the public catalog.">
                            <Badge variant="warn" size="xs">Awaiting publication</Badge>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-amber-400 font-mono text-[11px]">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{rev.rating}</span>
                      </div>
                    </div>
                    <p className="text-[var(--anchor-text-muted)] leading-relaxed pl-7">
                      {rev.text}
                    </p>
                    <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono pl-7 block">
                      {formatRelativeDate(rev.at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'changelog' && (
            <div className="space-y-4 max-w-2xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
                Release Versions & Changelog
              </h4>
              <div className="space-y-3">
                {listing.changelog.map((cl) => (
                  <div
                    key={cl.version}
                    className="p-3 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="accent" size="xs">v{cl.version}</Badge>
                      <span className="text-[11px] text-[var(--anchor-text-subtle)] font-mono">{formatRelativeDate(cl.at)}</span>
                    </div>
                    <p className="text-[var(--anchor-text)] mt-1 font-medium">{cl.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
