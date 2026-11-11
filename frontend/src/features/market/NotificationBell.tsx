import React, { useState, useEffect } from 'react';
import { useMarketStore } from '../../store/market';
import { Bell, Check } from 'lucide-react';
import { formatRelativeDate } from '../../lib/format';

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const notifications = useMarketStore((s) => s.notifications);
  const loadNotifications = useMarketStore((s) => s.loadNotifications);
  const markNotificationsRead = useMarketStore((s) => s.markNotificationsRead);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    markNotificationsRead(notifications.map((n) => n.id));
  };

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Market notifications"
        className="relative p-2 rounded-lg text-[var(--anchor-text-subtle)] hover:text-[var(--anchor-text)] hover:bg-[var(--anchor-surface-hover)] transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--anchor-accent)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--anchor-surface-elevated)] border border-[var(--anchor-border)] rounded-xl shadow-modal overflow-hidden z-40 text-left animate-in fade-in zoom-in-95 duration-100">
          <div className="p-3 border-b border-[var(--anchor-border)] flex items-center justify-between bg-[var(--anchor-surface)]">
            <span className="text-xs font-semibold text-[var(--anchor-text)]">
              Notifications ({unreadCount} unread)
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-[var(--anchor-accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-[var(--anchor-border-subtle)]">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 text-xs space-y-1 ${
                  n.read ? 'opacity-70 bg-transparent' : 'bg-[var(--anchor-accent)]/5'
                }`}
              >
                <p className="text-[var(--anchor-text)] leading-relaxed font-medium">
                  {n.text}
                </p>
                <span className="text-[10px] text-[var(--anchor-text-subtle)] font-mono block">
                  {formatRelativeDate(n.at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
