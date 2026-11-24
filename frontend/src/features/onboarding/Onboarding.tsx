import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StepCliInstall } from './StepCliInstall';
import { StepSignIn } from './StepSignIn';
import { StepProfile } from './StepProfile';
import { StepDrive } from './StepDrive';
import { AnchorGlyph } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { useSettingsStore } from '../../store/settings';
import { useAuthStore } from '../../store/auth';
import { useSyncStore } from '../../store/sync';
import { ArrowLeft, ArrowRight, Check, Cloud, Rocket, ShieldCheck, Terminal, UserRound, Wand2 } from 'lucide-react';

export interface OnboardingProps {
  onFinish: () => void;
}

type StepId = 'welcome' | 'cli' | 'signin' | 'profile' | 'drive' | 'launch';

interface StepDef {
  id: StepId;
  label: string;
  title: string;
  lead: string;
  icon: React.ReactNode;
}

/**
 * First-run wizard: one step per screen, a brand panel on the left that
 * doubles as progress, Back/Next on the right. Steps that the machine
 * already satisfies (CLI installed, signed in) are shown as done but can be
 * walked through; the CLI step is skipped entirely when agy is present.
 */
export const Onboarding: React.FC<OnboardingProps> = ({ onFinish }) => {
  const cliStatus = useSettingsStore((s) => s.cliStatus);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const account = useAuthStore((s) => s.account);
  const syncStatus = useSyncStore((s) => s.status);
  const thisDevice = useSyncStore((s) => s.thisDevice);
  const settings = useSettingsStore((s) => s.settings);

  const cliReady = Boolean(cliStatus?.installed);
  const signedIn = Boolean(account);
  const driveConnected = Boolean(syncStatus?.driveConnected);

  const steps: StepDef[] = useMemo(() => {
    const all: StepDef[] = [
      { id: 'welcome', label: 'Get started', title: 'Anchor', lead: 'Your Antigravity, anchored to you.', icon: <Wand2 className="w-4 h-4" /> },
      { id: 'cli', label: 'Antigravity CLI', title: 'Set up the Antigravity CLI', lead: 'Anchor runs on top of Google\'s Antigravity CLI. This installs it with Google\'s own installer.', icon: <Terminal className="w-4 h-4" /> },
      { id: 'signin', label: 'Google account', title: 'Sign in with Google', lead: 'Use the account that carries your AI subscription. Google handles the sign-in in your browser.', icon: <UserRound className="w-4 h-4" /> },
      { id: 'profile', label: 'About you', title: 'Tell the agent about you', lead: 'Your name, this device, and the rules the agent must always follow.', icon: <ShieldCheck className="w-4 h-4" /> },
      { id: 'drive', label: 'Google Drive', title: 'Keep your sessions with you', lead: 'Optional. Connect your own Google Drive and any device signed in to the same account can pick up where you stopped.', icon: <Cloud className="w-4 h-4" /> },
      { id: 'launch', label: 'Launch', title: 'You are set', lead: 'Everything below can be changed later in Settings.', icon: <Rocket className="w-4 h-4" /> },
    ];
    return cliReady ? all.filter((s) => s.id !== 'cli') : all;
  }, [cliReady]);

  const [index, setIndex] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [saving, setSaving] = useState(false);
  const profileSave = useRef<(() => Promise<boolean>) | null>(null);
  const step = steps[Math.min(index, steps.length - 1)];

  // If the CLI gets installed mid-way, the step list shrinks; keep the index sane.
  useEffect(() => {
    if (index > steps.length - 1) setIndex(steps.length - 1);
  }, [steps.length, index]);

  const next = () => setIndex((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setIndex((i) => Math.max(i - 1, 0));

  const done = (id: StepId): boolean => {
    switch (id) {
      case 'cli':
        return cliReady;
      case 'signin':
        return signedIn;
      case 'profile':
        return Boolean(settings.firstName);
      case 'drive':
        return driveConnected;
      default:
        return false;
    }
  };

  const canProceed = (id: StepId): boolean => {
    switch (id) {
      case 'cli':
        return cliReady;
      case 'signin':
        return signedIn;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (step.id === 'profile' && profileSave.current) {
      setSaving(true);
      const ok = await profileSave.current();
      setSaving(false);
      if (!ok) return;
    }
    next();
  };

  const launch = async () => {
    setLaunching(true);
    try {
      await updateSettings({ onboardingCompletedAt: new Date().toISOString() });
    } finally {
      setTimeout(onFinish, 450);
    }
  };

  const rulesCount = String(settings.agentRules ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean).length;

  return (
    <div className="h-screen w-screen bg-[var(--anchor-bg)] text-[var(--anchor-text)] flex select-none overflow-hidden">
      {/* Brand + progress panel */}
      {/* Top padding clears the macOS window controls; the panel doubles as the drag region. */}
      <aside
        style={{ ['--wails-draggable' as string]: 'drag' }}
        className="w-[38%] min-w-[320px] max-w-[460px] h-full border-r border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] flex flex-col justify-between px-10 pb-10 pt-16 relative overflow-hidden"
      >
        <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[var(--anchor-accent)] opacity-20 blur-3xl anchor-glow" />
        <div className="relative">
          <div className="relative w-28 h-28 anchor-float">
            <div className="absolute inset-0 rounded-full border border-[var(--anchor-accent)]/30 anchor-orbit">
              <span className="absolute -top-1 left-1/2 w-2 h-2 -ml-1 rounded-full bg-[var(--anchor-accent)] shadow-[0_0_12px_var(--anchor-accent)]" />
            </div>
            <div className="absolute inset-3 rounded-full border border-[var(--anchor-accent)]/15 anchor-orbit-slow">
              <span className="absolute top-1/2 -right-0.5 w-1.5 h-1.5 -mt-0.5 rounded-full bg-[var(--anchor-accent)]/70" />
            </div>
            <div className="absolute inset-6 rounded-2xl bg-[var(--anchor-accent)] text-white flex items-center justify-center shadow-lg shadow-[var(--anchor-accent)]/30 anchor-rise">
              <AnchorGlyph size={34} className="text-white" />
            </div>
          </div>
          <h1 className="mt-8 text-2xl font-bold tracking-tight anchor-rise anchor-rise-delay-1">Anchor</h1>
          <p className="mt-1 text-sm text-[var(--anchor-text-muted)] anchor-rise anchor-rise-delay-2">Your Antigravity, anchored to you.</p>
        </div>

        <ol style={{ ['--wails-draggable' as string]: 'no-drag' }} className="relative space-y-1 anchor-rise anchor-rise-delay-3">
          {steps.map((s, i) => {
            const active = i === index;
            const complete = i < index || done(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => i < index && setIndex(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    active ? 'bg-[var(--anchor-surface)] text-[var(--anchor-text)] border border-[var(--anchor-border)]' : 'text-[var(--anchor-text-muted)] hover:text-[var(--anchor-text)]'
                  } ${i < index ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                      complete && !active
                        ? 'bg-[var(--anchor-ok)]/15 border-[var(--anchor-ok)]/40 text-[var(--anchor-ok)]'
                        : active
                        ? 'bg-[var(--anchor-accent)] border-[var(--anchor-accent)] text-white'
                        : 'border-[var(--anchor-border)] text-[var(--anchor-text-subtle)]'
                    }`}
                  >
                    {complete && !active ? <Check className="w-3.5 h-3.5" /> : s.icon}
                  </span>
                  <span className="truncate">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="relative text-[11px] text-[var(--anchor-text-subtle)]">
          v{__APP_VERSION__} · macOS · Windows · Linux · open source
        </p>
      </aside>

      {/* Step panel */}
      <main className="flex-1 h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div key={step.id} className="max-w-2xl mx-auto w-full px-12 py-14 anchor-rise">
            {step.id === 'welcome' ? (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Set up in a minute.</h2>
                  <p className="mt-3 text-base text-[var(--anchor-text-muted)] leading-relaxed">
                    Sign in with Google, tell the agent how you like to work, and optionally connect your own Google Drive so every device picks up where you stopped. Nothing is hosted; your conversations stay on your machines and in your Drive.
                  </p>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    { icon: <Terminal className="w-4 h-4" />, t: 'Antigravity CLI', d: cliReady ? `Ready · ${cliStatus?.version ?? ''}` : 'Will be installed' },
                    { icon: <UserRound className="w-4 h-4" />, t: 'Google account', d: signedIn ? account?.email : 'Sign in next' },
                    { icon: <Cloud className="w-4 h-4" />, t: 'Google Drive', d: driveConnected ? 'Connected' : 'Optional' },
                  ].map((c) => (
                    <li key={c.t} className="p-3 rounded-xl border border-[var(--anchor-border)] bg-[var(--anchor-surface)]">
                      <div className="flex items-center gap-2 text-[var(--anchor-accent)]">{c.icon}<span className="text-[var(--anchor-text)] font-medium">{c.t}</span></div>
                      <div className="mt-1 text-xs text-[var(--anchor-text-subtle)] truncate">{c.d}</div>
                    </li>
                  ))}
                </ul>
                <div>
                  <Button variant="primary" size="md" icon={<ArrowRight className="w-4 h-4" />} iconPosition="right" onClick={next}>
                    Get started
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--anchor-accent)]">
                    Step {index} of {steps.length - 1}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">{step.title}</h2>
                  <p className="mt-2 text-sm text-[var(--anchor-text-muted)] leading-relaxed">{step.lead}</p>
                </div>

                {step.id === 'cli' && <StepCliInstall isCompleted={cliReady} onComplete={next} />}
                {step.id === 'signin' && <StepSignIn isCompleted={signedIn} onComplete={next} />}
                {step.id === 'profile' && (
                  <StepProfile
                    onComplete={next}
                    registerSave={(fn) => {
                      profileSave.current = fn;
                    }}
                  />
                )}
                {step.id === 'drive' && <StepDrive isCompleted={driveConnected} onComplete={next} />}
                {step.id === 'launch' && (
                  <div className="flex flex-col gap-4">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {[
                        ['Signed in as', account ? `${account.name} · ${account.email}` : 'Not signed in'],
                        ['This device', thisDevice?.name ?? '—'],
                        ['Google Drive', driveConnected ? `Connected${syncStatus?.driveEmail ? ` · ${syncStatus.driveEmail}` : ''}` : 'Not connected (Sync page, any time)'],
                        ['Standing instructions', rulesCount > 0 ? `${rulesCount} rule${rulesCount === 1 ? '' : 's'} in force` : 'None yet'],
                      ].map(([k, v]) => (
                        <div key={k} className="p-3 rounded-xl border border-[var(--anchor-border)] bg-[var(--anchor-surface)]">
                          <dt className="text-[11px] text-[var(--anchor-text-subtle)]">{k}</dt>
                          <dd className="mt-0.5 text-[var(--anchor-text)] truncate">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div>
                      <Button variant="primary" size="md" loading={launching} icon={<Rocket className="w-4 h-4" />} iconPosition="right" onClick={launch}>
                        Launch Anchor
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {step.id !== 'welcome' && step.id !== 'launch' && (
          <footer className="shrink-0 border-t border-[var(--anchor-border)] bg-[var(--anchor-surface-sunken)] px-12 py-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={back}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              {step.id === 'drive' && !driveConnected && (
                <Button variant="ghost" size="sm" onClick={next}>
                  Skip for now
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                disabled={!canProceed(step.id)}
                title={canProceed(step.id) ? undefined : 'Finish this step first'}
                icon={<ArrowRight className="w-4 h-4" />}
                iconPosition="right"
                onClick={handleNext}
              >
                {step.id === 'profile' ? 'Save and continue' : 'Next'}
              </Button>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
};
