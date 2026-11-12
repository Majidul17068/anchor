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

export interface Listing {
  id: string;
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
  lastSyncAt?: string;
  pending: number;
  conflicts: number;
  usageBytes: number;
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
