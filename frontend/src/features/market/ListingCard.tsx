import React from 'react';
import type { Listing } from '../../bridge/types';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { formatNumberCompact } from '../../lib/format';
import { Download, Sparkles, Star } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ListingCardProps {
  listing: Listing;
  onSelect: () => void;
  onQuickInstall?: () => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onSelect,
  onQuickInstall,
}) => {
  const isInstalled = Boolean(listing.installedVersion);
  const hasUpdate = isInstalled && listing.installedVersion !== listing.version;

  return (
    <div
      onClick={onSelect}
      className="flex flex-col justify-between p-4 rounded-xl border border-[var(--anchor-border)] bg-[var(--anchor-surface)] hover:border-[var(--anchor-border-focus)] hover:bg-[var(--anchor-surface-elevated)] transition-all cursor-pointer text-left shadow-xs group"
    >
      <div>
        {/* Top: Categories and Price Slot */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap gap-1">
            {listing.categories.slice(0, 2).map((cat) => (
              <Badge key={cat} variant="default" size="xs">
                {cat}
              </Badge>
            ))}
            {listing.trained && (
              <Badge variant="accent" size="xs">
                <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-400" />
                Trained
              </Badge>
            )}
          </div>
          {/* Price Label Slot */}
          <span className="text-[11px] font-mono uppercase font-bold text-[var(--anchor-ok)] px-1.5 py-0.5 rounded bg-[var(--anchor-ok-subtle)]">
            Free
          </span>
        </div>

        <h3 className="text-sm font-semibold text-[var(--anchor-text)] group-hover:text-[var(--anchor-accent)] transition-colors mb-1 truncate">
          {listing.name}
        </h3>

        <p className="text-xs text-[var(--anchor-text-muted)] line-clamp-2 leading-relaxed mb-4">
          {listing.tagline}
        </p>
      </div>

      <div className="pt-3 border-t border-[var(--anchor-border-subtle)] space-y-2.5">
        {/* Author info */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={listing.author.name} src={listing.author.avatarUrl} size="xs" />
            <span className="text-[11px] text-[var(--anchor-text-subtle)] truncate">
              {listing.author.name}
            </span>
          </div>
          <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">
            v{listing.version}
          </span>
        </div>

        {/* Rating and Installs stats */}
        <div className="flex items-center justify-between text-[11px] text-[var(--anchor-text-subtle)]">
          <div className="flex items-center gap-1 text-amber-400 font-medium">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{listing.rating.toFixed(1)}</span>
            <span className="text-[10px] text-[var(--anchor-text-subtle)]">
              ({listing.ratingCount})
            </span>
          </div>

          <div className="flex items-center gap-1 font-mono">
            <Download className="w-3 h-3" />
            <span>{formatNumberCompact(listing.installs)} installs</span>
          </div>
        </div>

        {/* Installation status banner */}
        {hasUpdate ? (
          <div className="w-full py-1 text-center bg-[var(--anchor-warn-subtle)] text-[var(--anchor-warn)] rounded font-semibold text-[10px] tracking-wide border border-[var(--anchor-warn)]/20">
            Update Available (v{listing.installedVersion} → v{listing.version})
          </div>
        ) : isInstalled ? (
          <div className="w-full py-0.5 text-center text-[var(--anchor-ok)] font-medium text-[10px]">
            Installed in Mine → Acquired
          </div>
        ) : null}
      </div>
    </div>
  );
};
