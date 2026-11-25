import type {
  Account,
  Agent,
  Attachment,
  ChatEvent,
  Conflict,
  Device,
  Effort,
  GitHubImport,
  Listing,
  ListingKind,
  Mode,
  Model,
  Notification,
  Platform,
  PluginInfo,
  Project,
  RemoteSession,
  Review,
  Session,
  Share,
  Skill,
  SkillRequest,
  Step,
  SyncFolderCandidate,
  SyncStatus,
  Usage,
  LearnStatus,
  Suggestion,
  SuggestionEdit,
  Automation,
  AutomationRun,
  AutomationSchedule,
  BackgroundStatus,
} from './types';
import { createMockBridge } from './mock';

export * from './types';

export interface AnchorBridge {
  system: {
    cliStatus(): Promise<{ installed: boolean; path?: string; version?: string; updateAvailable?: string }>;
    installCli(): AsyncIterable<{ phase: 'download' | 'install' | 'verify' | 'done'; percent: number; message: string }>;
    locateCli(): Promise<string | null>;
    platform(): Promise<Platform>;
    openExternal(url: string): Promise<void>;
    pickFolder(): Promise<string | null>;
    pickFiles(): Promise<Attachment[]>;
    /** Store pasted or dropped content (base64) as a file and return it as an attachment. */
    saveAttachment(name: string, mime: string, dataBase64: string): Promise<Attachment>;
    /** An image file as a data URL, for thumbnails in the chat. */
    imagePreview(path: string): Promise<string>;
  };
  auth: {
    status(): Promise<Account | null>;
    login(): Promise<Account>;
    logout(): Promise<void>;
  };
  devices: {
    thisDevice(): Promise<Device>;
    rename(name: string): Promise<void>;
    list(): Promise<Device[]>;
  };
  models: {
    list(): Promise<Model[]>;
  };
  usage: {
    /** Weekly and five-hour limits per model group, plus AI credits. Cached a minute unless force. */
    get(force?: boolean): Promise<Usage>;
  };
  projects: {
    list(): Promise<Project[]>;
  };
  sessions: {
    list(): Promise<Session[]>;
    get(id: string): Promise<{ session: Session; steps: Step[] }>;
    create(input: {
      title?: string;
      agentId?: string;
      modelId: string;
      effort: Effort;
      mode: Mode;
      workspacePaths: string[];
    }): Promise<Session>;
    update(
      id: string,
      patch: Partial<Pick<Session, 'title' | 'pinned' | 'modelId' | 'effort' | 'mode' | 'agentId'>>
    ): Promise<Session>;
    setSync(id: string, enabled: boolean): Promise<Session>; // rejects unless this device is origin
    delete(id: string): Promise<void>;
    exportMarkdown(id: string): Promise<string>;
  };
  chat: {
    send(sessionId: string, text: string, attachments?: Attachment[]): AsyncIterable<ChatEvent>;
    stop(sessionId: string): Promise<void>;
    resolvePermission(sessionId: string, stepId: string, decision: 'once' | 'always' | 'deny'): Promise<void>;
    resolveDiff(sessionId: string, stepId: string, accept: boolean): Promise<void>;
  };
  history: {
    search(
      q: string,
      filters?: {
        deviceId?: string;
        agentId?: string;
        projectId?: string;
        from?: string;
        to?: string;
        synced?: boolean;
      }
    ): Promise<Session[]>;
  };
  agents: {
    list(): Promise<Agent[]>;
    get(id: string): Promise<Agent>;
    save(agent: Omit<Agent, 'id' | 'source'> & { id?: string }): Promise<Agent>;
    delete(id: string): Promise<void>;
  };
  skills: {
    list(): Promise<Skill[]>;
    get(id: string): Promise<Skill>;
    save(skill: Omit<Skill, 'id' | 'source' | 'sharedWith' | 'updatedAt'> & { id?: string }): Promise<Skill>;
    delete(id: string): Promise<void>;
    evaluate(id: string): AsyncIterable<{ exampleId: string; pass: boolean; output: string }>;
    improve(id: string): Promise<Skill>;
    versions(id: string): Promise<{ version: string; at: string; summary: string }[]>;
    rollback(id: string, version: string): Promise<Skill>;
    share(id: string, email: string, permission: 'view' | 'copy'): Promise<Share>;
    revoke(id: string, email: string): Promise<void>;
    shareLink(id: string): Promise<string>;
    importFromLink(link: string): Promise<Skill>;
    /**
     * Adapt a public GitHub repository: a plugin (Claude Code or CLI format)
     * is installed through `agy plugin install` and fixed up; otherwise every
     * folder holding a SKILL.md becomes a skill, and a repo without one
     * becomes a single skill built from its README. Accepts `owner/repo`, a
     * repo URL, or a `/tree/<ref>/<path>` URL.
     */
    importFromGitHub(repo: string): Promise<GitHubImport>;
  };
  market: {
    search(
      q: string,
      opts?: { category?: string; sort?: 'trending' | 'newest' | 'installs' | 'rating'; page?: number }
    ): Promise<{ items: Listing[]; nextPage?: number }>;
    featured(): Promise<Listing[]>;
    get(id: string): Promise<Listing>;
    reviews(id: string): Promise<Review[]>;
    review(id: string, rating: number, text: string): Promise<Review>;
    install(id: string): Promise<Skill>; // copies into Mine -> Acquired
    uninstall(id: string): Promise<void>;
    checkUpdates(): Promise<{ listingId: string; from: string; to: string }[]>;
    /** Plugins installed in the CLI that can be shared. */
    plugins(): Promise<PluginInfo[]>;
    /** Publish a skill, an agent or a plugin of yours; id is the skill id, agent id or plugin name. */
    publish(
      kind: ListingKind,
      id: string,
      input: {
        name: string;
        tagline: string;
        description: string;
        categories: string[];
        visibility: 'public' | 'unlisted';
        license: string;
      }
    ): Promise<Listing>;
    unpublish(listingId: string): Promise<void>;
    myListings(): Promise<Listing[]>;
    requests(filter?: 'all' | 'mine' | 'to_me'): Promise<SkillRequest[]>;
    createRequest(input: {
      title: string;
      description: string;
      bounty?: string;
      toAuthorId?: string;
    }): Promise<SkillRequest>;
    replyRequest(id: string, text: string, listingId?: string): Promise<SkillRequest>;
    fulfillRequest(id: string): Promise<SkillRequest>;
    notifications(): Promise<Notification[]>;
    markRead(ids: string[]): Promise<void>;
  };
  sync: {
    status(): Promise<SyncStatus>;
    connectDrive(): Promise<SyncStatus>;
    /** Point Anchor at a synced folder by hand (when none was detected). */
    chooseFolder(): Promise<SyncStatus>;
    /** Synced folders detected on this machine (Google Drive, iCloud, Dropbox, OneDrive). */
    folderCandidates(): Promise<SyncFolderCandidate[]>;
    /** Use one of them (or any folder path). */
    useFolder(path: string): Promise<SyncStatus>;
    /** Launch Google Drive for Desktop when its folder is not responding (desktop shell only). */
    openDriveClient?(): Promise<void>;
    disconnectDrive(): Promise<void>;
    /** Whether signing in to Drive with a chosen Google account is available in this build. */
    canChooseAccount(): Promise<boolean>;
    /**
     * Sign in to Drive with an account picked in the browser, replacing the current connection.
     * With keepSyncing, sessions that have Sync on are saved to the new account.
     */
    changeAccount(keepSyncing: boolean): Promise<SyncStatus>;
    syncNow(): Promise<SyncStatus>;
    /** Pull latest: exchange one session with Drive now, both directions; returns the session afterwards. */
    refresh(sessionId: string): Promise<Session>;
    conflicts(): Promise<Conflict[]>;
    resolveConflict(sessionId: string, as: 'parent' | 'merged'): Promise<void>;
    /** Sessions on Drive from other devices, not yet pulled here. */
    available(): Promise<RemoteSession[]>;
    /** Pull one of them as a local replica that can be continued. */
    pull(sessionId: string): Promise<Session>;
    onChange(cb: (status: SyncStatus) => void): () => void;
  };
  settings: {
    get(): Promise<Record<string, unknown>>;
    set(patch: Record<string, unknown>): Promise<void>;
  };
  /** Scheduled tasks Anchor runs unattended; each run is a fresh conversation. */
  automations: {
    list(): Promise<Automation[]>;
    /** Create (no id) or update. */
    save(a: Partial<Automation> & Pick<Automation, 'name' | 'prompt' | 'schedule' | 'access'>): Promise<Automation>;
    setEnabled(id: string, on: boolean): Promise<Automation>;
    delete(id: string): Promise<void>;
    runNow(id: string): Promise<void>;
    runs(id: string): Promise<AutomationRun[]>;
    /** A schedule in words and its next run, without saving. */
    preview(s: AutomationSchedule): Promise<{ text: string; nextRunAt: string }>;
    /** The Antigravity CLI's own scheduled automations not yet in Anchor. */
    importable(): Promise<Automation[]>;
    /** Write it in the CLI's format (shows in Google's dashboard, off); returns the file path. */
    exportToCli(id: string): Promise<string>;
    background(): Promise<BackgroundStatus>;
    setBackground(runInBackground: boolean, startAtLogin: boolean): Promise<BackgroundStatus>;
    quit(): Promise<void>;
    onChange(cb: () => void): () => void;
  };
  /** "Learn from my work": proposals drawn from how the user works; nothing applies until accepted. */
  learn: {
    status(): Promise<LearnStatus>;
    list(): Promise<Suggestion[]>;
    /** Study recent conversations now; returns the number of new drafts. Spends one agent turn. */
    run(): Promise<number>;
    update(id: string, edit: SuggestionEdit): Promise<Suggestion>;
    accept(id: string, edit?: SuggestionEdit): Promise<Suggestion>;
    reject(id: string): Promise<void>;
    /** Erase every draft, decision and the run history. */
    forget(): Promise<void>;
    onStatus(cb: (status: LearnStatus) => void): () => void;
  };
}

declare global {
  interface Window {
    anchorBridge?: AnchorBridge;
  }
}

let bridgeInstance: AnchorBridge | null = null;

export function getBridge(): AnchorBridge {
  if (typeof window !== 'undefined' && window.anchorBridge) {
    return window.anchorBridge;
  }
  if (!bridgeInstance) {
    bridgeInstance = createMockBridge();
    if (typeof window !== 'undefined') {
      window.anchorBridge = bridgeInstance;
    }
  }
  return bridgeInstance;
}
