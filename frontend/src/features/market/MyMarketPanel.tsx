import React, { useEffect } from 'react';
import { useMarketStore } from '../../store/market';
import { confirmDialog } from '../../store/confirm';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { formatNumberCompact, formatRelativeDate } from '../../lib/format';
import { Download, Star, Trash2, Upload, MessageSquare, Bell } from 'lucide-react';

export const MyMarketPanel: React.FC = () => {
  const myListings = useMarketStore((s) => s.myListings);
  const requests = useMarketStore((s) => s.requests);
  const notifications = useMarketStore((s) => s.notifications);
  const unpublishListing = useMarketStore((s) => s.unpublishListing);
  const loadRequests = useMarketStore((s) => s.loadRequests);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const requestsToMe = requests.filter((r) => r.toAuthor?.id === 'auth_majidul');
  const myRequests = requests.filter((r) => r.requester.id === 'auth_majidul');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left max-w-4xl mx-auto w-full">
      {/* My Published Listings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)]">
            My Published Listings ({myListings.length})
          </span>
        </div>

        {myListings.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-[var(--anchor-border)] text-xs text-[var(--anchor-text-subtle)] text-center">
            You haven&apos;t published any skills yet. Select any skill from &apos;Mine&apos; and click Publish.
          </div>
        ) : (
          <div className="space-y-3">
            {myListings.map((l) => (
              <div
                key={l.id}
                className="p-4 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-xl flex items-center justify-between gap-4 text-xs shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--anchor-text)]">
                      {l.name}
                    </span>
                    <Badge variant="accent" size="xs">v{l.version}</Badge>
                    <Badge variant={l.visibility === 'public' ? 'ok' : 'default'} size="xs">
                      {l.visibility}
                    </Badge>
                  </div>
                  <p className="text-[var(--anchor-text-muted)]">{l.tagline}</p>
                  <div className="flex items-center gap-4 text-[11px] text-[var(--anchor-text-subtle)] pt-1">
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Star className="w-3 h-3 fill-current" />
                      {l.rating.toFixed(1)} ({l.ratingCount})
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Download className="w-3 h-3" />
                      {formatNumberCompact(l.installs)} installs
                    </span>
                    <span className="font-mono">Published {formatRelativeDate(l.publishedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    icon={<Trash2 className="w-3.5 h-3.5 text-[var(--anchor-danger)]" />}
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: `Unpublish "${l.name}"?`,
                        message: 'The listing is removed from the Anchor Marketplace. Installed copies are unaffected.',
                        confirmLabel: 'Unpublish',
                        danger: true,
                      });
                      if (ok) unpublishListing(l.id);
                    }}
                  >
                    Unpublish
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Requests sent to me */}
      <div className="space-y-3 pt-4 border-t border-[var(--anchor-border-subtle)]">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--anchor-text-subtle)] block">
          Custom Skill Inquiries Addressed to Me ({requestsToMe.length})
        </span>
        {requestsToMe.length === 0 ? (
          <div className="p-4 rounded-xl bg-[var(--anchor-surface-sunken)] text-xs text-[var(--anchor-text-subtle)]">
            No pending custom inquiries directed to you.
          </div>
        ) : (
          <div className="space-y-2">
            {requestsToMe.map((r) => (
              <div
                key={r.id}
                className="p-3 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-xl text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--anchor-text)]">{r.title}</span>
                  <Badge variant="warn" size="xs">{r.status}</Badge>
                </div>
                <p className="text-[var(--anchor-text-muted)] text-[11px]">{r.description}</p>
                <span className="text-[10px] text-[var(--anchor-text-subtle)] block pt-1">
                  Requested by <strong>{r.requester.name}</strong> • {formatRelativeDate(r.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
