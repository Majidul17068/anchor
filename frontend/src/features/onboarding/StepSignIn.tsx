import React, { useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { CheckCircle2, Globe, LogIn } from 'lucide-react';

export interface StepSignInProps {
  onComplete: () => void;
  isCompleted: boolean;
}

export const StepSignIn: React.FC<StepSignInProps> = ({ onComplete, isCompleted }) => {
  const account = useAuthStore((s) => s.account);
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const [waitingBrowser, setWaitingBrowser] = useState(false);

  const handleLogin = async () => {
    setWaitingBrowser(true);
    await login();
    setWaitingBrowser(false);
    // Only a sign-in that produced an account completes the step.
    if (useAuthStore.getState().account) onComplete();
  };

  const getPlanBadge = (plan?: string) => {
    switch (plan) {
      case 'google_ai_pro':
        return <Badge variant="accent" size="sm">Google AI Pro</Badge>;
      case 'google_ai_ultra':
        return <Badge variant="accent" size="sm">Google AI Ultra</Badge>;
      case 'free':
        return <Badge variant="default" size="sm">Free Tier</Badge>;
      default:
        return <Badge variant="default" size="sm">Standard Plan</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-3 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-[var(--anchor-accent)]" />
          <h4 className="text-sm font-semibold text-[var(--anchor-text)]">
            2. Sign in with Google
          </h4>
        </div>
        {isCompleted && account && (
          <span className="flex items-center gap-1 text-xs text-[var(--anchor-ok)] font-medium">
            <CheckCircle2 className="w-4 h-4" /> Authenticated
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--anchor-text-muted)] leading-relaxed">
        Use the Google account that has your AI subscription (Google AI Pro or Ultra). Anchor authenticates directly via local OAuth loopback.
      </p>

      {account ? (
        <div className="flex items-center justify-between p-3 bg-[var(--anchor-surface-sunken)] rounded-lg border border-[var(--anchor-border)]">
          <div className="flex items-center gap-3">
            <Avatar name={account.name} src={account.avatarUrl} size="md" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--anchor-text)]">
                {account.name}
              </span>
              <span className="text-[11px] text-[var(--anchor-text-subtle)] font-mono">
                {account.email}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getPlanBadge(account.plan)}
            <Button size="xs" variant="outline" onClick={onComplete}>
              Continue
            </Button>
          </div>
        </div>
      ) : waitingBrowser ? (
        <div className="p-4 bg-[var(--anchor-surface-sunken)] rounded-lg border border-[var(--anchor-accent)]/30 flex items-center justify-center gap-3">
          <div className="w-4 h-4 border-2 border-[var(--anchor-accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[var(--anchor-text)] font-medium">
            Finish in your browser... Waiting for Google authentication handshake.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            variant="primary"
            size="sm"
            icon={<LogIn className="w-4 h-4" />}
            onClick={handleLogin}
          >
            Sign in with Google Account
          </Button>
          {error && (
            <p role="alert" className="text-xs text-[var(--anchor-danger)] leading-relaxed">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
