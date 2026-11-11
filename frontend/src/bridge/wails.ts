/**
 * Real AnchorBridge for the desktop shell. Every call maps onto a method of
 * the Go `API` struct bound by Wails as `window.go.main.API`; streams are
 * reconstructed from Wails events so the UI keeps its AsyncIterable contract.
 */
import type { AnchorBridge } from './index';
import type {
  Account,
  Agent,
  Attachment,
  ChatEvent,
  Conflict,
  Device,
  Listing,
  Model,
  Notification,
  Platform,
  Project,
  Review,
  Session,
  Share,
  Skill,
  SkillRequest,
  Step,
  SyncStatus,
} from './types';

type AnyFn = (...args: unknown[]) => Promise<unknown>;

function api(): Record<string, AnyFn> {
  const a = window.go?.main?.API;
  if (!a) throw new Error('Anchor desktop bridge is not available');
  return a;
}

export function isWails(): boolean {
  return typeof window !== 'undefined' && !!window.go?.main?.API && !!window.runtime;
}

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (typeof e === 'string') return new Error(e);
  try {
    return new Error(JSON.stringify(e));
  } catch {
    return new Error('Unknown error');
  }
}

async function call<T>(name: string, ...args: unknown[]): Promise<T> {
  const fn = api()[name];
  if (!fn) throw new Error(`Bridge method ${name} is missing`);
  try {
    return (await fn(...args)) as T;
  } catch (e) {
    throw toError(e);
  }
}

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A push queue that an async iterator drains. */
class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: Array<(r: IteratorResult<T>) => void> = [];
  private closed = false;
  private error: Error | null = null;

  push(v: T) {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w({ value: v, done: false });
    else this.items.push(v);
  }

  close(err?: Error) {
    if (this.closed) return;
    this.closed = true;
    this.error = err ?? null;
    for (const w of this.waiters) w({ value: undefined as unknown as T, done: true });
    this.waiters = [];
  }

  next(): Promise<IteratorResult<T>> {
    if (this.items.length) return Promise.resolve({ value: this.items.shift() as T, done: false });
    if (this.closed) {
      if (this.error) return Promise.reject(this.error);
      return Promise.resolve({ value: undefined as unknown as T, done: true });
    }
    return new Promise((res) => this.waiters.push(res));
  }
}

/**
 * Subscribe to `event`, then run `start`. Events flow until `isLast` returns
 * true for one of them (that event is still delivered) or `start` rejects.
 */
function stream<T>(event: string, start: () => Promise<unknown>, isLast: (ev: T) => boolean, mapErr?: (e: Error) => T): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      const q = new AsyncQueue<T>();
      const off = window.runtime!.EventsOn(event, (data) => {
        const ev = data as T;
        q.push(ev);
        if (isLast(ev)) {
          off();
          q.close();
        }
      });
      start().catch((e) => {
        const err = toError(e);
        if (mapErr) q.push(mapErr(err));
        off();
        q.close(mapErr ? undefined : err);
      });
      return {
        next: () => q.next(),
        return: async () => {
          off();
          q.close();
          return { value: undefined as unknown as T, done: true };
        },
      };
    },
  };
}

export function createWailsBridge(): AnchorBridge {
  return {
    system: {
      cliStatus: () => call('SystemCliStatus'),
      installCli: () =>
        stream<{ phase: 'download' | 'install' | 'verify' | 'done'; percent: number; message: string }>(
          'cli:install',
          () => call('SystemInstallCli'),
          (ev) => ev.phase === 'done'
        ),
      locateCli: () => call<string>('SystemLocateCli').then((p) => p || null),
      platform: () => call<Platform>('SystemPlatform'),
      openExternal: (url) => call('SystemOpenExternal', url),
      pickFolder: () => call<string>('SystemPickFolder').then((p) => p || null),
      pickFiles: () => call<Attachment[]>('SystemPickFiles').then((f) => f ?? []),
    },

    auth: {
      status: () => call<Account | null>('AuthStatus'),
      login: () => call<Account>('AuthLogin'),
      logout: () => call('AuthLogout'),
    },

    devices: {
      thisDevice: () => call<Device>('DevicesThis'),
      rename: (name) => call('DevicesRename', name),
      list: () => call<Device[]>('DevicesList').then((d) => d ?? []),
    },

    models: { list: () => call<Model[]>('ModelsList').then((m) => m ?? []) },
    projects: { list: () => call<Project[]>('ProjectsList').then((p) => p ?? []) },

    sessions: {
      list: () => call<Session[]>('SessionsList').then((s) => s ?? []),
      get: (id) => call<{ session: Session; steps: Step[] }>('SessionsGet', id),
      create: (input) => call<Session>('SessionsCreate', input),
      update: (id, patch) => call<Session>('SessionsUpdate', id, patch),
      setSync: (id, enabled) => call<Session>('SessionsSetSync', id, enabled),
      delete: (id) => call('SessionsDelete', id),
      exportMarkdown: (id) => call<string>('SessionsExportMarkdown', id),
    },

    chat: {
      send: (sessionId, text, attachments) => {
        const streamId = randomId();
        return stream<ChatEvent>(
          `chat:${streamId}`,
          () => call('ChatSend', sessionId, streamId, text, attachments ?? []),
          (ev) => ev.type === 'done',
          (err) => ({ type: 'error', message: err.message, code: err.message.startsWith('AUTH_REQUIRED') ? 'auth' : 'cli' })
        );
      },
      stop: (sessionId) => call('ChatStop', sessionId),
      resolvePermission: (sessionId, stepId, decision) => call('ChatResolvePermission', sessionId, stepId, decision),
      resolveDiff: (sessionId, stepId, accept) => call('ChatResolveDiff', sessionId, stepId, accept),
    },

    history: {
      search: (q, filters) => call<Session[]>('HistorySearch', q, filters ?? {}).then((s) => s ?? []),
    },

    agents: {
      list: () => call<Agent[]>('AgentsList').then((a) => a ?? []),
      get: (id) => call<Agent>('AgentsGet', id),
      save: (agent) => call<Agent>('AgentsSave', agent),
      delete: (id) => call('AgentsDelete', id),
    },

    skills: {
      list: () => call<Skill[]>('SkillsList').then((s) => s ?? []),
      get: (id) => call<Skill>('SkillsGet', id),
      save: (skill) => call<Skill>('SkillsSave', skill),
      delete: (id) => call('SkillsDelete', id),
      evaluate: (id) =>
        stream<{ exampleId: string; pass: boolean; output: string; done?: boolean }>(
          `skills:eval:${id}`,
          () => call('SkillsEvaluate', id),
          (ev) => ev.done === true
        ),
      improve: (id) => call<Skill>('SkillsImprove', id),
      versions: (id) => call<{ version: string; at: string; summary: string }[]>('SkillsVersions', id).then((v) => v ?? []),
      rollback: (id, version) => call<Skill>('SkillsRollback', id, version),
      share: (id, email, permission) => call<Share>('SkillsShare', id, email, permission),
      revoke: (id, email) => call('SkillsRevoke', id, email),
      shareLink: (id) => call<string>('SkillsShareLink', id),
      importFromLink: (link) => call<Skill>('SkillsImportFromLink', link),
      importFromGitHub: (repo) => call<Skill[]>('SkillsImportFromGitHub', repo).then((s) => s ?? []),
    },

    market: {
      search: (q, opts) => call<{ items: Listing[]; nextPage?: number }>('MarketSearch', q, opts ?? {}),
      featured: () => call<Listing[]>('MarketFeatured').then((l) => l ?? []),
      get: (id) => call<Listing>('MarketGet', id),
      reviews: (id) => call<Review[]>('MarketReviews', id).then((r) => r ?? []),
      review: (id, rating, text) => call<Review>('MarketReview', id, rating, text),
      install: (id) => call<Skill>('MarketInstall', id),
      uninstall: (id) => call('MarketUninstall', id),
      checkUpdates: () => call<{ listingId: string; from: string; to: string }[]>('MarketCheckUpdates').then((u) => u ?? []),
      publish: (skillId, input) => call<Listing>('MarketPublish', skillId, input),
      unpublish: (listingId) => call('MarketUnpublish', listingId),
      myListings: () => call<Listing[]>('MarketMyListings').then((l) => l ?? []),
      requests: (filter) => call<SkillRequest[]>('MarketRequests', filter ?? 'all').then((r) => r ?? []),
      createRequest: (input) => call<SkillRequest>('MarketCreateRequest', input),
      replyRequest: (id, text, listingId) => call<SkillRequest>('MarketReplyRequest', id, text, listingId ?? ''),
      fulfillRequest: (id) => call<SkillRequest>('MarketFulfillRequest', id),
      notifications: () => call<Notification[]>('MarketNotifications').then((n) => n ?? []),
      markRead: (ids) => call('MarketMarkRead', ids),
    },

    sync: {
      status: () => call<SyncStatus>('SyncStatus'),
      connectDrive: () => call<SyncStatus>('SyncConnectDrive'),
      disconnectDrive: () => call('SyncDisconnectDrive'),
      syncNow: () => call<SyncStatus>('SyncNow'),
      conflicts: () => call<Conflict[]>('SyncConflicts').then((c) => c ?? []),
      resolveConflict: (sessionId, as) => call('SyncResolveConflict', sessionId, as),
      onChange: (cb) => window.runtime!.EventsOn('sync:status', (data) => cb(data as SyncStatus)),
    },

    settings: {
      get: () => call<Record<string, unknown>>('SettingsGet'),
      set: (patch) => call('SettingsSet', patch),
    },
  };
}
