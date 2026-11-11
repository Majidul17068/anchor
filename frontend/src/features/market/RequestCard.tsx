import React, { useState } from 'react';
import type { SkillRequest } from '../../bridge/types';
import { useMarketStore } from '../../store/market';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { formatRelativeDate } from '../../lib/format';
import {
  CheckCircle2,
  Coins,
  CornerDownRight,
  MessageSquare,
  Send,
  User,
} from 'lucide-react';

export interface RequestCardProps {
  request: SkillRequest;
  isRequester: boolean;
}

export const RequestCard: React.FC<RequestCardProps> = ({ request, isRequester }) => {
  const [replyText, setReplyText] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);

  const replyRequest = useMarketStore((s) => s.replyRequest);
  const fulfillRequest = useMarketStore((s) => s.fulfillRequest);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    await replyRequest(request.id, replyText.trim());
    setReplyText('');
    setShowReplyBox(false);
  };

  const handleFulfill = async () => {
    await fulfillRequest(request.id);
  };

  const statusBadge = {
    open: <Badge variant="warn" size="xs">Open Request</Badge>,
    answered: <Badge variant="info" size="xs">Answered</Badge>,
    fulfilled: <Badge variant="ok" size="xs">Fulfilled</Badge>,
  }[request.status];

  return (
    <div className="p-4 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-xl text-xs text-left space-y-3 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--anchor-text)]">
              {request.title}
            </h4>
            {statusBadge}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--anchor-text-subtle)]">
            <Avatar name={request.requester.name} src={request.requester.avatarUrl} size="xs" />
            <span>{request.requester.name}</span>
            {request.toAuthor && (
              <span className="text-[var(--anchor-accent)]">
                → Requested specifically from <strong>{request.toAuthor.name}</strong>
              </span>
            )}
            <span>•</span>
            <span className="font-mono">{formatRelativeDate(request.at)}</span>
          </div>
        </div>

        {request.bounty && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--anchor-warn-subtle)] text-[var(--anchor-warn)] font-semibold text-xs border border-[var(--anchor-warn)]/20 shrink-0">
            <Coins className="w-3.5 h-3.5" />
            <span>{request.bounty}</span>
          </div>
        )}
      </div>

      <p className="text-[var(--anchor-text-muted)] leading-relaxed text-xs">
        {request.description}
      </p>

      {/* Replies thread */}
      {request.replies.length > 0 && (
        <div className="pl-4 border-l-2 border-[var(--anchor-border)] space-y-2 pt-1">
          {request.replies.map((rep, idx) => (
            <div key={idx} className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-[var(--anchor-text)]">
                <Avatar name={rep.author.name} src={rep.author.avatarUrl} size="xs" />
                <span>{rep.author.name}</span>
                <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono">
                  {formatRelativeDate(rep.at)}
                </span>
              </div>
              <p className="text-[var(--anchor-text-muted)] pl-5">{rep.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--anchor-border-subtle)]">
        <button
          onClick={() => setShowReplyBox(!showReplyBox)}
          className="flex items-center gap-1.5 text-xs text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-accent)] cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Reply or Link a Skill</span>
        </button>

        {isRequester && request.status !== 'fulfilled' && (
          <Button
            size="xs"
            variant="outline"
            icon={<CheckCircle2 className="w-3.5 h-3.5 text-[var(--anchor-ok)]" />}
            onClick={handleFulfill}
          >
            Mark as Fulfilled
          </Button>
        )}
      </div>

      {showReplyBox && (
        <div className="flex items-center gap-2 pt-2 animate-in fade-in duration-100">
          <input
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReply()}
            placeholder="Reply with advice or paste a listing link..."
            className="flex-1 bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--anchor-text)] focus:outline-none"
          />
          <Button size="xs" variant="primary" icon={<Send className="w-3 h-3" />} onClick={handleReply}>
            Post
          </Button>
        </div>
      )}
    </div>
  );
};
