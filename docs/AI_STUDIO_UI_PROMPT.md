# Prompt for Google AI Studio (Build mode)

Copy everything below the line into Google AI Studio → Build → new app.
It asks for a complete React + TypeScript UI that runs standalone with mock data,
so you can iterate on the design in AI Studio as the POC. The desktop shell
(Electron) later replaces the mock `window.anchorBridge` with a real one. Keep the
bridge contract and the names exactly as written so the two halves fit.

---

Build a complete, production-quality desktop application UI called **Anchor**.
It is a cross-platform desktop client (macOS, Windows, Linux) for Google's
Antigravity CLI (`agy`). Think of it as an OpenClaw-style control center for a
personal AI agent, but for Google Antigravity: the user signs in with the Google
account that holds their Google AI Pro subscription, chats with Gemini and other
models through the CLI, browses full chat history, creates agents, creates and
trains skills, shares skills with other Google users, publishes skills to a
public marketplace, and keeps every session synchronized across all their devices
using their own Google Drive as the database. The name means: one fixed point
you can return to from any device.

## Naming (use these exactly, everywhere)

| Thing | Name |
|---|---|
| Product name (UI, title bar, about) | `Anchor` |
| Tagline (welcome screen, about) | `Your Antigravity, anchored to you.` |
| npm package / repo / app id | `anchor` / `anchor-desktop` / `com.anchor.desktop` |
| Window title pattern | `Anchor — <session title>` |
| Global bridge | `window.anchorBridge` (type `AnchorBridge`) |
| Mock factory | `createMockBridge()` in `src/bridge/mock.ts` |
| Type names | plain: `Session`, `Step`, `Agent`, `Skill`, `Listing`… no `Anchor` prefix |
| CSS tokens | `--anchor-bg`, `--anchor-surface`, `--anchor-accent`, `--anchor-warn`, `--anchor-ok`… |
| Local storage keys | `anchor.theme`, `anchor.rail`, `anchor.lastSession` |
| Logo | a minimal anchor glyph in an SVG, rounded, single color, used at 16/24/32 px and as the empty-state illustration |
| The CLI it drives | always "Antigravity CLI" in UI copy, `agy` in code and settings |
| Marketplace | `Anchor Marketplace` on screen, `market` in code |
| Devices concept | "parent source" for the device that created a session, "replica" for others |
| Skill sections | Mine · Acquired · Shared with me · Plugins · Builtin |

Do not use "Agy Desktop", "Antigravity Desktop", or any other product name.
Do not use the Antigravity or Google logos; Anchor is an independent client.

## Project structure (required, exactly this layout)

The POC is the `ui` package of a larger monorepo. Generate it so it can be
moved into `anchor/apps/ui/` without edits: no absolute imports outside `src`,
all paths relative or via the `@/` alias that maps to `src/`.

```
anchor-ui/
├── package.json                 name "anchor", scripts: dev, build, preview, typecheck
├── index.html                   <title>Anchor</title>, favicon anchor glyph
├── vite.config.ts               @ → src alias
├── tsconfig.json                strict, paths @/*
├── tailwind.config.ts           reads the --anchor-* tokens
├── README.md
└── src/
    ├── main.tsx                 mounts <App/>, picks real or mock bridge
    ├── App.tsx                  router + shell
    ├── styles/
    │   ├── tokens.css           --anchor-* for light/dark
    │   └── globals.css
    ├── bridge/
    │   ├── types.ts             all data types (below)
    │   ├── index.ts             AnchorBridge interface + getBridge()
    │   └── mock.ts              createMockBridge() + seed data
    ├── store/                   one zustand store per domain
    │   ├── session.ts  chat.ts  agents.ts  skills.ts  market.ts  sync.ts  settings.ts  auth.ts
    ├── shell/
    │   ├── Rail.tsx  Sidebar.tsx  Inspector.tsx  TitleBar.tsx  CommandPalette.tsx
    ├── features/
    │   ├── onboarding/   Onboarding.tsx  StepCliInstall.tsx  StepSignIn.tsx  StepDevice.tsx  StepDrive.tsx
    │   ├── chat/         ChatPage.tsx  SessionList.tsx  SessionRow.tsx  Transcript.tsx  Composer.tsx
    │   │                 MessageBubble.tsx  ThinkingBlock.tsx  ToolCallCard.tsx  PermissionCard.tsx  DiffCard.tsx
    │   │                 ModelPicker.tsx  AgentPicker.tsx  EffortPicker.tsx  ModePicker.tsx  SyncToggle.tsx
    │   ├── history/      HistoryPage.tsx  HistoryFilters.tsx  HistoryRow.tsx
    │   ├── agents/       AgentsPage.tsx  AgentCard.tsx  AgentEditor.tsx  AgentTestPanel.tsx
    │   ├── skills/       SkillsPage.tsx  SkillCard.tsx  SkillEditor.tsx  SkillFileTree.tsx  TrainPanel.tsx
    │   │                 VersionList.tsx  ShareDialog.tsx  ImportDialog.tsx
    │   ├── market/       MarketPage.tsx  ListingCard.tsx  ListingDetail.tsx  PublishWizard.tsx
    │   │                 RequestsTab.tsx  RequestCard.tsx  MyMarketPanel.tsx  NotificationBell.tsx
    │   ├── sync/         SyncPage.tsx  DeviceCard.tsx  DriveStatus.tsx  ConflictList.tsx  RulesPanel.tsx
    │   └── settings/     SettingsPage.tsx  CliSection.tsx  AccountSection.tsx  AppearanceSection.tsx  ShortcutsSection.tsx  DangerZone.tsx
    ├── components/              shared primitives
    │   ├── Button.tsx  Input.tsx  Select.tsx  Switch.tsx  Badge.tsx  Avatar.tsx  Tabs.tsx  Dialog.tsx
    │   ├── Toast.tsx  Tooltip.tsx  EmptyState.tsx  Skeleton.tsx  MarkdownView.tsx  CodeBlock.tsx  Kbd.tsx
    ├── hooks/                   useShortcut.ts  useTheme.ts  useStream.ts  useDebounce.ts
    └── lib/                     format.ts (dates, bytes)  ids.ts  markdown.ts  cn.ts
```

Rules: one component per file, named export matching the filename, feature
folders never import from each other (only from `components`, `store`,
`bridge`, `hooks`, `lib`), and every bridge call goes through a store, never
directly from a component.

## Tech and constraints

- React 18 + TypeScript + Vite + Tailwind CSS + zustand + react-router. Single-page
  app with client-side routing.
- No backend calls of your own. ALL data and actions go through one typed
  interface: `window.anchorBridge` (defined below). Ship a complete **mock
  implementation** (`src/bridge/mock.ts`) with realistic seeded data and simulated
  streaming so the app is fully usable in the AI Studio preview. The real desktop
  shell will inject its own implementation with the same shape.
- Must look and feel like a native desktop app, not a website: dense but calm
  layout, resizable sidebar, keyboard shortcuts, no marketing sections, no
  footer, minimum window width 1024px, works up to ultra-wide.
- Dark theme by default, light theme available, follow system by default.
- Accessibility: focus rings, ARIA labels, full keyboard navigation of the
  session list and message input.
- Handle every state: loading, empty, streaming, error, offline, CLI missing,
  signed out, rate limited, sync conflict.

## Visual design

- Premium, minimal, Google-adjacent but distinct. Material 3 spacing and
  elevation logic, not Material components.
- Palette tokens on `:root` with dark and light variants, named `--anchor-*`. Accent: electric
  indigo (#6C5CE7) with a warm amber (#F5A623) for sync/parent-source states and
  a teal (#1FB6A6) for shared/skills. Neutral surfaces in layered grays, never
  pure black.
- Typography: Inter for UI, JetBrains Mono for code and tool output.
- Subtle motion only: 150–200ms ease-out, streaming cursor, skeleton loaders.
- Three-column shell: left rail (icons: Chat, History, Agents, Skills,
  Marketplace, Sync, Settings), left sidebar (contextual list), main pane. A right inspector pane
  that slides in for details (tool call output, skill files, device info).

## Screens

### 1. Onboarding / Sign-in (zero-config for a brand-new user)
A single welcome screen with a vertical step list and live progress. The user
only reads, clicks, and allows; everything else is automatic:
1. "Setting up Antigravity CLI" → the app checks for `agy`; if missing it
   downloads and installs it automatically with a progress bar
   (`bridge.system.installCli()` streams progress). Shows version when done.
   Fallback "Locate binary" link for advanced users.
2. "Sign in with Google" → one button runs `bridge.auth.login()`, which opens
   the browser. Show a waiting state ("Finish in your browser…"), then the
   account avatar, email, and a plan badge (`Google AI Pro`, `Google AI
   Ultra`, `Free`, `Unknown`). Plain-language note: "Use the Google account
   that has your AI subscription."
3. "Name this device" → text field, default = hostname. Explains that the
   device that creates a session is its *parent source*.
4. "Connect Google Drive for sync" → optional; explains Drive is the user's own
   database (app-data folder), nothing goes to a third-party server.
5. "Done" → opens Chat.

### 2. Chat (main screen)
- Sidebar: session list grouped by **This device**, **Synced from other
  devices**, **Not synced**. Each row: title, agent chip, last activity, model,
  origin device icon, sync status dot. Pinned sessions. Search box filters by
  title. "New session" button with agent and workspace folder pickers.
- Header: session title (editable), agent picker, model picker (loaded from
  `bridge.models.list()`), reasoning effort (low/medium/high/xhigh/max), mode
  (plan / auto / accept-edits), workspace folder chip, origin device badge, and
  a **Sync toggle** that is enabled ONLY when this device is the parent source
  (otherwise disabled with tooltip "Only the parent source controls sync").
- Transcript: message bubbles for user and agent; collapsible **thinking**
  blocks; **tool call cards** (name, arguments, status, duration, expandable
  output); **permission prompts** inline with Allow once / Allow always / Deny;
  file-diff cards with accept/reject; code blocks with copy; markdown rendering.
- Composer: multiline, Enter to send, Shift+Enter newline, slash-command
  autocomplete (`/model`, `/agent`, `/skill`, `/clear`), attach files, stop
  button while streaming, token/step counter.
- Streaming via `bridge.chat.send()` which returns an async iterator of events.

### 3. History
- Full-text search across all conversations (`bridge.history.search`).
- Filters: device, agent, project, date range, synced/unsynced.
- Table/list with title, preview, step count, last modified, origin device.
- Actions: Open, Resume in new session, Export markdown, Delete (local only),
  Publish to Drive / Unpublish (parent source only).

### 4. Agents
- Grid of agent cards: name, description, model, attached skills count, source
  (builtin / plugin / mine / shared).
- Create/Edit agent form: name, description, system instructions (markdown
  editor), default model, default effort, allowed tools (checkbox matrix),
  attached skills (multi-select), MCP servers (multi-select). Live "Test" panel
  that opens a scratch session with the agent.

### 5. Skills
- Library tabs: **Mine**, **Shared with me**, **Plugins**, **Builtin**.
- Skill card: name, one-line description, version, author, trigger phrases,
  file count, last trained.
- Skill editor: file tree (SKILL.md + supporting files), markdown editor with
  frontmatter form (name, description, triggers), and a **Train** tab: add
  example prompts + expected behavior, "Run evaluation" shows pass/fail per
  example with the agent's output; "Improve" asks the model to revise SKILL.md
  from failures; versions list with diff and rollback.
- **Share** dialog: enter Google account emails, choose permission (view / can
  copy), generate link, list of people with access, revoke. Shows a note that
  recipients need a Google account; the app cannot check their AI plan.
- Import from share link.

### 6. Marketplace
**Anchor Marketplace**: a public catalog of skills published by any Anchor user.
- Home: search bar, category chips (Coding, Writing, Research, Data, DevOps,
  Design, Productivity, Other), sort (Trending, Newest, Most installed, Top
  rated), featured row, and a "Requests" tab.
- Listing card: name, one-line description, author (name + avatar), version,
  installs, rating, categories, "Trained" badge if it has passing examples,
  price label (free for now; design the slot).
- Listing detail (inspector or full page): long description (markdown),
  SKILL.md preview, file list, example prompts, changelog, reviews with
  rating, author's other skills. Primary button **Add to my skills**
  (`bridge.market.install`) which copies it into **Mine → Acquired** and keeps
  a link to the listing for updates. "Request an update" and "Report".
- Publish flow (from a skill in **Mine**): choose listing name, categories,
  description, visibility (Public / Unlisted link), license, screenshots;
  shows a checklist (SKILL.md present, description ≥ 40 chars, at least 1
  example, no secrets detected). Publishing creates or updates a listing;
  updates bump the version and notify installers.
- **Requests** tab: anyone can post "I need a skill that…" with title,
  description, bounty label (optional, free text for now). Others can reply
  with a listing link; the requester marks it fulfilled. Users can also
  request a specific skill from a specific author ("Request from author").
- My Marketplace panel: my listings (installs, rating, pending update),
  my requests, requests sent to me, notifications.

### 7. Sync & Devices
- This device card: name, id, platform, parent source of N sessions.
- Drive status: connected account, app-folder usage, last sync, "Sync now".
- Device list: each device, last seen, sessions originated there.
- Rules panel explaining the model: parent source decides publish/unpublish;
  other devices auto-pull; replicas may append and the parent merges.
- Conflict log: session, devices involved, resolution (parent wins / merged),
  with "View both versions".

### 8. Settings
- CLI: binary path, version, "Check for update", telemetry toggle.
- Account: signed-in email, plan, sign out.
- Appearance: theme, density, font size.
- Shortcuts list.
- Danger zone: clear local cache, disconnect Drive.

## Data types (put in `src/bridge/types.ts`)

```ts
export type Plan = 'google_ai_pro' | 'google_ai_ultra' | 'free' | 'unknown';
export type Platform = 'darwin' | 'win32' | 'linux';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type Mode = 'plan' | 'auto' | 'accept-edits';

export interface Account { email: string; name: string; avatarUrl?: string; plan: Plan; }
export interface Device { id: string; name: string; platform: Platform; lastSeen: string; isThisDevice: boolean; }
export interface Model { id: string; label: string; family: 'gemini' | 'claude' | 'other'; }
export interface Project { id: string; name: string; workspacePaths: string[]; }

export interface Session {
  id: string; title: string; preview: string;
  agentId?: string; modelId: string; effort: Effort; mode: Mode;
  projectId?: string; workspacePaths: string[];
  originDeviceId: string;                 // parent source
  syncEnabled: boolean;                   // only parent can change
  syncState: 'local' | 'published' | 'replica' | 'conflict';
  stepCount: number; createdAt: string; lastModified: string; pinned: boolean;
}

export type Step =
  | { kind: 'user'; id: string; text: string; attachments?: Attachment[]; at: string }
  | { kind: 'agent'; id: string; markdown: string; at: string; streaming?: boolean }
  | { kind: 'thinking'; id: string; text: string; at: string }
  | { kind: 'tool_call'; id: string; tool: string; args: unknown; status: 'pending' | 'running' | 'ok' | 'error' | 'denied'; output?: string; durationMs?: number; at: string }
  | { kind: 'permission'; id: string; tool: string; description: string; resolved?: 'once' | 'always' | 'deny'; at: string }
  | { kind: 'diff'; id: string; path: string; patch: string; accepted?: boolean; at: string };

export interface Attachment { name: string; path: string; mime: string; size: number; }

export interface Agent {
  id: string; name: string; description: string; source: 'builtin' | 'plugin' | 'mine' | 'shared';
  instructions: string; modelId: string; effort: Effort; tools: string[]; skillIds: string[]; mcpServers: string[];
}

export interface SkillFile { path: string; content: string; }
export interface SkillExample { id: string; prompt: string; expected: string; lastResult?: { pass: boolean; output: string } }
export interface Skill {
  id: string; name: string; description: string; version: string; author: string;
  source: 'builtin' | 'plugin' | 'mine' | 'shared'; triggers: string[];
  files: SkillFile[]; examples: SkillExample[]; sharedWith: Share[]; updatedAt: string;
}
export interface Share { email: string; permission: 'view' | 'copy'; sharedAt: string; }

export type ChatEvent =
  | { type: 'step'; step: Step }
  | { type: 'step_update'; id: string; patch: Partial<Step> }
  | { type: 'token'; stepId: string; delta: string }
  | { type: 'done'; sessionId: string }
  | { type: 'error'; message: string; code?: 'rate_limited' | 'offline' | 'auth' | 'cli' };

export interface MarketAuthor { id: string; name: string; avatarUrl?: string; }
export interface Listing {
  id: string; skillId?: string;            // skillId set when installed locally
  name: string; tagline: string; description: string; version: string;
  author: MarketAuthor; categories: string[]; installs: number; rating: number; ratingCount: number;
  trained: boolean; visibility: 'public' | 'unlisted'; license: string;
  files: SkillFile[]; examples: SkillExample[]; changelog: { version: string; at: string; notes: string }[];
  publishedAt: string; updatedAt: string; installedVersion?: string;
}
export interface Review { id: string; listingId: string; author: MarketAuthor; rating: number; text: string; at: string; }
export interface SkillRequest {
  id: string; title: string; description: string; bounty?: string;
  requester: MarketAuthor; toAuthor?: MarketAuthor;      // set for "request from author"
  status: 'open' | 'answered' | 'fulfilled'; replies: { author: MarketAuthor; listingId?: string; text: string; at: string }[];
  at: string;
}
export interface Notification { id: string; kind: 'update' | 'request' | 'reply' | 'review' | 'share'; text: string; at: string; read: boolean; link?: string; }

export interface SyncStatus {
  driveConnected: boolean; driveEmail?: string; lastSyncAt?: string;
  pending: number; conflicts: number; usageBytes: number;
}
export interface Conflict { sessionId: string; devices: string[]; resolvedAs?: 'parent' | 'merged'; at: string; }
```

## Bridge contract (put in `src/bridge/index.ts`; mock in `src/bridge/mock.ts`)

```ts
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
  devices: { thisDevice(): Promise<Device>; rename(name: string): Promise<void>; list(): Promise<Device[]> };
  models: { list(): Promise<Model[]> };
  projects: { list(): Promise<Project[]> };
  sessions: {
    list(): Promise<Session[]>;
    get(id: string): Promise<{ session: Session; steps: Step[] }>;
    create(input: { title?: string; agentId?: string; modelId: string; effort: Effort; mode: Mode; workspacePaths: string[] }): Promise<Session>;
    update(id: string, patch: Partial<Pick<Session, 'title' | 'pinned' | 'modelId' | 'effort' | 'mode' | 'agentId'>>): Promise<Session>;
    setSync(id: string, enabled: boolean): Promise<Session>;   // rejects unless this device is origin
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
    search(q: string, filters?: { deviceId?: string; agentId?: string; projectId?: string; from?: string; to?: string; synced?: boolean }): Promise<Session[]>;
  };
  agents: {
    list(): Promise<Agent[]>; get(id: string): Promise<Agent>;
    save(agent: Omit<Agent, 'id' | 'source'> & { id?: string }): Promise<Agent>;
    delete(id: string): Promise<void>;
  };
  skills: {
    list(): Promise<Skill[]>; get(id: string): Promise<Skill>;
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
  };
  market: {
    search(q: string, opts?: { category?: string; sort?: 'trending' | 'newest' | 'installs' | 'rating'; page?: number }): Promise<{ items: Listing[]; nextPage?: number }>;
    featured(): Promise<Listing[]>;
    get(id: string): Promise<Listing>;
    reviews(id: string): Promise<Review[]>;
    review(id: string, rating: number, text: string): Promise<Review>;
    install(id: string): Promise<Skill>;                    // copies into Mine → Acquired
    uninstall(id: string): Promise<void>;
    checkUpdates(): Promise<{ listingId: string; from: string; to: string }[]>;
    publish(skillId: string, input: { name: string; tagline: string; description: string; categories: string[]; visibility: 'public' | 'unlisted'; license: string }): Promise<Listing>;
    unpublish(listingId: string): Promise<void>;
    myListings(): Promise<Listing[]>;
    requests(filter?: 'all' | 'mine' | 'to_me'): Promise<SkillRequest[]>;
    createRequest(input: { title: string; description: string; bounty?: string; toAuthorId?: string }): Promise<SkillRequest>;
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
declare global { interface Window { anchorBridge: AnchorBridge } }
```

At startup: `const bridge = window.anchorBridge ?? createMockBridge();`

## Mock data requirements

- 2 devices (this MacBook, "Home PC"), 14 sessions spread across both with
  mixed sync states including 1 conflict, 4 agents (1 builtin, 1 plugin, 2
  mine), 8 skills across all four sources, 2 shared-with-me skills.
- Models list: the Gemini 4 Argon family (low/medium/high), Gemini 3.8 Flash
  (low/medium/high), Claude Opus 5.5 and Claude Sonnet 5.5 (low/medium/high),
  GPT-OSS 120B.
- Marketplace: 24 listings across all categories from 10 authors, 6 reviews,
  5 open requests (2 addressed to "me"), 4 notifications, 1 installed listing
  with an update available. `system.installCli` in the mock simulates a 4 s
  download with progress events.
- `chat.send` streams tokens with 20–40ms delay, inserts one thinking block,
  one tool call that goes pending → running → ok, and one permission prompt
  that blocks until resolved.
- `sessions.setSync` throws `Error('NOT_PARENT_SOURCE')` for sessions whose
  originDeviceId is not this device; surface it as a toast.

## Deliverables

- The exact file tree above, every file fully written, no placeholders or
  TODOs, `npm run typecheck` clean.
- Keyboard shortcuts: Cmd/Ctrl+N new session, Cmd/Ctrl+K command palette
  (jump to session, agent, skill, listing, setting), Cmd/Ctrl+1..7 switch rail,
  Cmd/Ctrl+Shift+S toggle sync (parent only), Esc stop streaming.
- README titled "Anchor" explaining the bridge contract and how the desktop
  shell replaces the mock.
- `package.json` name `anchor`, `<title>Anchor</title>`, favicon = the anchor
  glyph.
