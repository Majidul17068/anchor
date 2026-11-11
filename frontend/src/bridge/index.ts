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
  Mode,
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
    publish(
      skillId: string,
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
    disconnectDrive(): Promise<void>;
    syncNow(): Promise<SyncStatus>;
    conflicts(): Promise<Conflict[]>;
    resolveConflict(sessionId: string, as: 'parent' | 'merged'): Promise<void>;
    onChange(cb: (status: SyncStatus) => void): () => void;
  };
  settings: {
    get(): Promise<Record<string, unknown>>;
    set(patch: Record<string, unknown>): Promise<void>;
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
