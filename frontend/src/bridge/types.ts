export type Plan = 'google_ai_pro' | 'google_ai_ultra' | 'free' | 'unknown';
export type Platform = 'darwin' | 'win32' | 'linux';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type Mode = 'default' | 'plan' | 'auto' | 'accept-edits';

export interface Account {
  email: string;
  name: string;
  avatarUrl?: string;
  plan: Plan;
  /** Tier name exactly as the Antigravity CLI reports it. */
  planName?: string;
  /** Where the CLI says to go for a higher tier. */
  upgradeUrl?: string;
}

export interface Device {
  id: string;
  name: string;
  platform: Platform;
  lastSeen: string;
  isThisDevice: boolean;
}

export interface Model {
  id: string;
  label: string;
  family: 'gemini' | 'claude' | 'other';
  reasoningEfforts?: Effort[];
}

export interface Project {
  id: string;
  name: string;
  workspacePaths: string[];
}

export interface Session {
  id: string;
  title: string;
  preview: string;
  agentId?: string;
  modelId: string;
  effort: Effort;
  mode: Mode;
  projectId?: string;
  workspacePaths: string[];
  originDeviceId: string; // parent source
  syncEnabled: boolean; // only parent can change
  syncState: 'local' | 'published' | 'replica' | 'conflict';
  stepCount: number;
  createdAt: string;
  lastModified: string;
  pinned: boolean;
  /** When this device last exchanged the session with Drive. */
  lastSyncedAt?: string;
  /** Tokens in the model's context window for this chat, and the window's size. */
  contextUsed?: number;
  contextSize?: number;
}

/**
 * One improvement Anchor proposes after studying how you work: a standing
 * instruction, or a draft skill or agent. It has no effect until accepted.
 */
export interface Suggestion {
  id: string;
  kind: 'rule' | 'skill' | 'agent';
  title: string;
  reason: string;
  evidence: string[];
  occurrences: number;
  status: 'draft' | 'accepted' | 'rejected';
  createdAt: string;
  decidedAt?: string;
  /** The instruction text (kind rule). */
  rule?: string;
  /** Skill or agent: its name, when to use it, and its instructions. */
  name?: string;
  description?: string;
  body?: string;
  tools?: string[];
  /** Id of the skill or agent created by accepting, for sharing it. */
  createdId?: string;
}

/** What may be changed on a draft before approving it. */
export type SuggestionEdit = Partial<Pick<Suggestion, 'title' | 'rule' | 'name' | 'description' | 'body' | 'tools'>>;

export interface LearnStatus {
  enabled: boolean;
  running: boolean;
  drafts: number;
  lastRunAt?: string;
  lastError?: string;
  /** The knowledge base is kept on Google Drive and shared with the user's other devices. */
  driveConnected?: boolean;
  driveSyncedAt?: string;
}

/** One limit of the account: window is "weekly" or "5h". */
export interface UsageBucket {
  id: string;
  name: string;
  description?: string;
  window: string;
  /** 0..1, share of the limit still available. */
  remainingFraction: number;
  resetTime?: string;
}

/** Models that share limits, e.g. "Gemini Models". */
export interface UsageGroup {
  name: string;
  description?: string;
  buckets: UsageBucket[];
}

/** The signed-in account's model limits, as the Antigravity CLI reports them. */
export interface Usage {
  tier?: string;
  description?: string;
  groups: UsageGroup[];
  credits?: { remaining: number; upgradeUri?: string };
  fetchedAt: string;
}

export interface Attachment {
  name: string;
  path: string;
  mime: string;
  size: number;
}

export type Step =
  | { kind: 'user'; id: string; text: string; attachments?: Attachment[]; at: string }
  | { kind: 'agent'; id: string; markdown: string; at: string; streaming?: boolean }
  | { kind: 'thinking'; id: string; text: string; at: string }
  | {
      kind: 'tool_call';
      id: string;
      tool: string;
      args: unknown;
      status: 'pending' | 'running' | 'ok' | 'error' | 'denied';
      output?: string;
      durationMs?: number;
      at: string;
    }
  | {
      kind: 'permission';
      id: string;
      tool: string;
      description: string;
      resolved?: 'once' | 'always' | 'deny';
      at: string;
    }
  | { kind: 'diff'; id: string; path: string; patch: string; accepted?: boolean; at: string };

export interface Agent {
  id: string;
  name: string;
  description: string;
  source: 'builtin' | 'plugin' | 'mine' | 'shared';
  instructions: string;
  modelId: string;
  effort: Effort;
  tools: string[];
  skillIds: string[];
  mcpServers: string[];
  /** False when the file exists but the Antigravity CLI does not list it (so Test cannot run it). */
  discovered?: boolean;
}

export interface SkillFile {
  path: string;
  content: string;
}

/** What adapting a GitHub repository produced. */
export interface GitHubImport {
  skills: Skill[];
  /** Set when the repository was installed as a CLI plugin. */
  plugin?: string;
  /** Skills the plugin left outside skills/ that Anchor exposed. */
  linkedSkills?: string[];
  /** Agents whose Claude-style frontmatter was rewritten for the CLI. */
  fixedAgents?: string[];
  notes?: string[];
}

export interface SkillExample {
  id: string;
  prompt: string;
  expected: string;
  lastResult?: { pass: boolean; output: string };
}

export interface Share {
  email: string;
  permission: 'view' | 'copy';
  sharedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  source: 'builtin' | 'plugin' | 'mine' | 'shared';
  triggers: string[];
  files: SkillFile[];
  examples: SkillExample[];
  sharedWith: Share[];
  updatedAt: string;
}

export type ChatEvent =
  | { type: 'step'; step: Step }
  | { type: 'step_update'; id: string; patch: Partial<Step> }
  | { type: 'token'; stepId: string; delta: string }
  | { type: 'done'; sessionId: string }
  | { type: 'error'; message: string; code?: 'rate_limited' | 'offline' | 'auth' | 'cli' };

export interface MarketAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export type ListingKind = 'skill' | 'agent' | 'plugin';

/** A plugin installed in the Antigravity CLI, as shown in the publish wizard. */
export interface PluginInfo {
  name: string;
  displayName: string;
  version: string;
  description: string;
  /** Where it came from: "marketplace", "local" or "anchor" (installed from the Anchor Marketplace). */
  origin: string;
  enabled: boolean;
}

export interface Listing {
  id: string;
  /** What the listing contains; missing means skill. */
  kind?: ListingKind;
  skillId?: string; // skillId set when installed locally
  name: string;
  tagline: string;
  description: string;
  version: string;
  author: MarketAuthor;
  categories: string[];
  installs: number;
  rating: number;
  ratingCount: number;
  trained: boolean;
  visibility: 'public' | 'unlisted';
  license: string;
  files: SkillFile[];
  examples: SkillExample[];
  changelog: { version: string; at: string; notes: string }[];
  publishedAt: string;
  updatedAt: string;
  installedVersion?: string;
}

export interface Review {
  id: string;
  listingId: string;
  author: MarketAuthor;
  rating: number;
  text: string;
  at: string;
  /** The signed-in user's own review. */
  mine?: boolean;
  /** Saved here and submitted, not yet in the public catalog. */
  pending?: boolean;
}

export interface SkillRequest {
  id: string;
  title: string;
  description: string;
  bounty?: string;
  requester: MarketAuthor;
  toAuthor?: MarketAuthor; // set for "request from author"
  status: 'open' | 'answered' | 'fulfilled';
  replies: { author: MarketAuthor; listingId?: string; text: string; at: string }[];
  at: string;
}

export interface Notification {
  id: string;
  kind: 'update' | 'request' | 'reply' | 'review' | 'share';
  text: string;
  at: string;
  read: boolean;
  link?: string;
}

export interface SyncStatus {
  driveConnected: boolean;
  driveEmail?: string;
  /** "folder": sessions go into a synced folder on this machine (Google Drive for Desktop); "api": Drive API. */
  backend?: 'folder' | 'api';
  folderPath?: string;
  folderKind?: 'google-drive' | 'icloud' | 'dropbox' | 'onedrive' | 'folder';
  /**
   * "ok", or why the chosen folder cannot be used right now:
   * DRIVE_CLIENT_NOT_RUNNING, DRIVE_CLIENT_MISSING, DRIVE_UNREACHABLE, DRIVE_NOT_FOUND.
   */
  health?: string;
  healthMessage?: string;
  lastSyncAt?: string;
  pending: number;
  conflicts: number;
  usageBytes: number;
}

/** A folder a cloud client keeps in sync on this machine. */
export interface SyncFolderCandidate {
  path: string;
  kind: 'google-drive' | 'icloud' | 'dropbox' | 'onedrive' | 'folder';
  label: string;
  /** False when the folder exists but its cloud client is not running. */
  reachable?: boolean;
}

/** A session another device published to Drive that this one has not pulled. */
export interface RemoteSession {
  id: string;
  title: string;
  originDeviceId: string;
  originDeviceName?: string;
  /** Folder under Anchor/, e.g. "2026/11/12" — the day the session was created. */
  day: string;
  stepCount: number;
  updatedAt: string;
  sizeBytes: number;
}

export interface Conflict {
  sessionId: string;
  devices: string[];
  resolvedAs?: 'parent' | 'merged';
  at: string;
}
