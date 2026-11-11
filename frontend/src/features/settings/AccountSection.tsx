import React from 'react';
import { useAuthStore } from '../../store/auth';
import { confirmDialog } from '../../store/confirm';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { LogOut, User } from 'lucide-react';

export const AccountSection: React.FC = () => {
  const account = useAuthStore((s) => s.account);
  const logout = useAuthStore((s) => s.logout);
  const login = useAuthStore((s) => s.login);

  return (
    <div className="p-5 bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl text-left space-y-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--anchor-border-subtle)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--anchor-surface-sunken)] border border-[var(--anchor-border)] flex items-center justify-center text-[var(--anchor-info)]">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--anchor-text)]">
              Google Account & AI Subscription
            </h3>
            <p className="text-xs text-[var(--anchor-text-muted)]">
              Anchor utilizes your Google AI subscription credentials for cloud inference.
            </p>
          </div>
        </div>

        {account && (
          <Badge
            variant={account.plan === 'google_ai_pro' ? 'accent' : 'default'}
            size="xs"
            className="uppercase font-mono tracking-wider"
          >
            {account.plan === 'google_ai_pro' ? 'Google AI Pro' : account.plan}
          </Badge>
        )}
      </div>

      {account ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={account.name} src={account.avatarUrl} size="lg" />
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-[var(--anchor-text)] block">
                {account.name}
              </span>
              <span className="text-xs text-[var(--anchor-text-subtle)] font-mono block">
                {account.email}
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={<LogOut className="w-3.5 h-3.5" />}
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Sign out of Google?',
                message: 'Anchor and the Antigravity CLI both forget this account. You will need to sign in again to chat.',
                confirmLabel: 'Sign out',
                danger: true,
              });
              if (ok) logout();
            }}
          >
            Sign Out
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--anchor-text-subtle)]">
            Not currently signed in with a Google account.
          </span>
          <Button size="sm" variant="primary" onClick={login}>
            Sign In with Google
          </Button>
        </div>
      )}
    </div>
  );
};
