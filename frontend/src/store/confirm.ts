import { create } from 'zustand';

/**
 * In-app confirmation and text prompts.
 *
 * `window.confirm` and `window.prompt` are not usable inside the desktop
 * shell: Wails' WebKit delegate on macOS implements only the file-open panel,
 * so both return immediately (false / null) without showing anything. Every
 * destructive button that relied on them (sign out, delete session, delete
 * agent, …) was silently a no-op. Call `confirmDialog()` / `promptDialog()`
 * instead; `ConfirmHost` renders whichever is pending.
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
}

type Pending =
  | ({ kind: 'confirm'; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: 'prompt'; resolve: (value: string | null) => void } & PromptOptions);

interface ConfirmState {
  pending: Pending | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  askText: (opts: PromptOptions) => Promise<string | null>;
  settle: (value: boolean | string | null) => void;
}

function cancel(p: Pending | null) {
  if (!p) return;
  if (p.kind === 'confirm') p.resolve(false);
  else p.resolve(null);
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  pending: null,

  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      // A second prompt while one is open cancels the first rather than
      // stacking: the user can only answer one question at a time.
      cancel(get().pending);
      set({ pending: { kind: 'confirm', ...opts, resolve } });
    }),

  askText: (opts) =>
    new Promise<string | null>((resolve) => {
      cancel(get().pending);
      set({ pending: { kind: 'prompt', ...opts, resolve } });
    }),

  settle: (value) => {
    const p = get().pending;
    set({ pending: null });
    if (!p) return;
    if (p.kind === 'confirm') p.resolve(value === true);
    else p.resolve(typeof value === 'string' ? value : null);
  },
}));

export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === 'string' ? { title: opts } : opts;
  return useConfirmStore.getState().ask(o);
}

export function promptDialog(opts: PromptOptions | string): Promise<string | null> {
  const o = typeof opts === 'string' ? { title: opts } : opts;
  return useConfirmStore.getState().askText(o);
}
