import React, { useEffect, useState } from 'react';
import { StepCliInstall } from './StepCliInstall';
import { StepSignIn } from './StepSignIn';
import { StepDevice } from './StepDevice';
import { StepDrive } from './StepDrive';
import { AnchorGlyph } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../../store/settings';
import { useAuthStore } from '../../store/auth';
import { useSyncStore } from '../../store/sync';

export interface OnboardingProps {
  onFinish: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onFinish }) => {
  const cliStatus = useSettingsStore((s) => s.cliStatus);
  const account = useAuthStore((s) => s.account);
  const syncStatus = useSyncStore((s) => s.status);

  // Steps start from the real state of this machine, not from a fixture.
  const [completedSteps, setCompletedSteps] = useState<{
    cli: boolean;
    auth: boolean;
    device: boolean;
    drive: boolean;
  }>({
    cli: Boolean(cliStatus?.installed),
    auth: Boolean(account),
    device: false,
    drive: Boolean(syncStatus?.driveConnected),
  });

  useEffect(() => {
    setCompletedSteps((prev) => ({
      ...prev,
      cli: prev.cli || Boolean(cliStatus?.installed),
      auth: prev.auth || Boolean(account),
      drive: prev.drive || Boolean(syncStatus?.driveConnected),
    }));
  }, [cliStatus?.installed, account, syncStatus?.driveConnected]);

  const canLaunch = completedSteps.cli && completedSteps.auth;

  const markComplete = (step: 'cli' | 'auth' | 'device' | 'drive') => {
    setCompletedSteps((prev) => ({ ...prev, [step]: true }));
  };

  return (
    // h-screen + my-auto rather than min-h-screen + justify-center: the body
    // cannot scroll, so a card taller than a small window was clipped at both
    // ends with the Launch button out of reach. Now the viewport-sized box
    // scrolls and the card centres only when it fits.
    <div className="h-screen w-full bg-[var(--anchor-bg)] text-[var(--anchor-text)] flex flex-col items-center p-6 select-none overflow-y-auto">
      <div className="w-full max-w-xl my-auto bg-[var(--anchor-surface)] border border-[var(--anchor-border)] rounded-2xl shadow-modal p-8 flex flex-col gap-8 text-left animate-in fade-in zoom-in-95 duration-200">
        {/* Brand header */}
        <div className="flex items-center gap-4 border-b border-[var(--anchor-border)] pb-6">
          <div className="w-12 h-12 rounded-2xl bg-[var(--anchor-accent-subtle)] flex items-center justify-center text-[var(--anchor-accent)] shrink-0 border border-[var(--anchor-accent)]/20 shadow-xs">
            <AnchorGlyph size={28} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-[var(--anchor-text)] flex items-center gap-2">
              Welcome to Anchor
            </h1>
            <p className="text-xs text-[var(--anchor-text-muted)] font-medium">
              Your Antigravity, anchored to you.
            </p>
          </div>
        </div>

        {/* Step list */}
        <div className="flex flex-col gap-6">
          <StepCliInstall
            isCompleted={completedSteps.cli}
            onComplete={() => markComplete('cli')}
          />
          <div className="border-t border-[var(--anchor-border-subtle)]" />
          <StepSignIn
            isCompleted={completedSteps.auth}
            onComplete={() => markComplete('auth')}
          />
          <div className="border-t border-[var(--anchor-border-subtle)]" />
          <StepDevice
            isCompleted={completedSteps.device}
            onComplete={() => markComplete('device')}
          />
          <div className="border-t border-[var(--anchor-border-subtle)]" />
          <StepDrive
            isCompleted={completedSteps.drive}
            onComplete={() => markComplete('drive')}
          />
        </div>

        {/* Action Done */}
        <div className="pt-4 border-t border-[var(--anchor-border)] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[var(--anchor-text-subtle)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--anchor-accent)]" />
            <span>Zero-configuration sync ready across macOS, Windows & Linux</span>
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<ArrowRight className="w-4 h-4" />}
            iconPosition="right"
            disabled={!canLaunch}
            title={canLaunch ? undefined : 'Install the Antigravity CLI and sign in with Google first'}
            onClick={onFinish}
          >
            Launch Anchor
          </Button>
        </div>
      </div>
    </div>
  );
};
