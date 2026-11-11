# Anchor

> **Your Antigravity, anchored to you.**

Anchor is a high-performance, cross-platform desktop client (macOS, Windows, Linux) for Google's Antigravity CLI (`agy`). Built as an OpenClaw-style command center for your personal AI agents, Anchor links to the Google account holding your Google AI Pro or Ultra subscription. It gives you full chat history, an agent manager, interactive skill authoring and training harnesses, skill sharing with Google accounts, the public **Anchor Marketplace**, and automatic cross-device session synchronization using your personal Google Drive app-data storage as the database.

---

## Architecture: The Global Bridge Contract

Anchor is built with a zero-dependency separation between the presentation UI and native desktop/CLI capabilities. All system operations, auth handshakes, file operations, model streaming, and sync coordination pass through a single, strictly typed global interface:

```typescript
window.anchorBridge: AnchorBridge
```

### Bridge Interface Overview

The `AnchorBridge` interface (defined in `src/bridge/index.ts` and `src/bridge/types.ts`) provides 10 service domains:

- **`system`**: Antigravity CLI (`agy`) daemon detection, automated binary installation/updates with live progress streams, native folder pickers, and external browser link opening.
- **`auth`**: Local OAuth loopback handshake with Google AI Pro/Ultra accounts.
- **`devices`**: Device mesh discovery, identifying the current machine and other replicas.
- **`models`**: Available models (Gemini 4 Argon, Gemini 3.8 Flash, Claude Opus 5.5, Claude Sonnet 5.5, GPT-OSS 120B).
- **`projects`**: Local workspaces and repository bounds.
- **`sessions`**: Session creation, updating, parent-source authority sync toggling, deletion, and Markdown export.
- **`chat`**: Streaming conversation events (`step`, `token`, `step_update`, `done`), interactive tool approvals, and patch diff resolutions.
- **`history`**: Full-text fuzzy search and multi-facet filtering across all sessions.
- **`agents`**: Agent presets, tool permissions matrix, and attached skills.
- **`skills`**: SKILL.md authoring, automated regression evaluation, AI self-improvement, version rollback, and Drive share links.
- **`market`**: Public catalog discovery, 1-click installation to `Mine → Acquired`, reviews, skill requests, and creator publishing.
- **`sync`**: Google Drive `appDataFolder` state, vector clocks, and conflict merge resolutions.

### Replacing the Mock with the Real Desktop Shell

When running inside the Electron, Tauri, or native desktop shell, the host application injects its native implementation directly onto the window object before rendering:

```typescript
// Desktop preload script (e.g., Electron contextBridge or Tauri IPC)
contextBridge.exposeInMainWorld('anchorBridge', nativeBridgeImplementation);
```

At application bootstrap in `src/main.tsx` and `src/bridge/index.ts`:

```typescript
export function getBridge(): AnchorBridge {
  if (typeof window !== 'undefined' && window.anchorBridge) {
    return window.anchorBridge;
  }
  // Falls back to complete mock implementation for browser preview and tests
  return createMockBridge();
}
```

The mock implementation (`src/bridge/mock.ts`) ships with realistic data including 2 devices, 14 multi-device sessions with sync conflict simulations, 4 agent personas, 8 skills across all library tabs, and 24 marketplace listings across 8 categories.

---

## Key Concepts & Naming

- **Parent Source**: The physical device that originally created a session. Only the parent source controls whether a session is synchronized to Google Drive or deleted.
- **Replica**: Any other device logged into the same Google account. Replicas auto-pull published sessions and append signed change deltas.
- **Skill Sections**: `Mine` · `Acquired` · `Shared with me` · `Plugins` · `Builtin`.
- **Google Drive as Database**: Anchor uses the hidden `drive.appdata` folder. No third-party relay or telemetry servers exist between your machines.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Universal Command Palette (Jump to session, agent, skill, action) |
| `Cmd/Ctrl + N` | Create new Antigravity session |
| `Cmd/Ctrl + 1` | Switch to Chat |
| `Cmd/Ctrl + 2` | Switch to History |
| `Cmd/Ctrl + 3` | Switch to Agents Manager |
| `Cmd/Ctrl + 4` | Switch to Skills Library |
| `Cmd/Ctrl + 5` | Switch to Anchor Marketplace |
| `Cmd/Ctrl + 6` | Switch to Sync & Devices |
| `Cmd/Ctrl + 7` | Switch to Settings |
| `Cmd/Ctrl + Shift + S` | Toggle Google Drive sync (Parent source only) |
| `Esc` | Stop active model streaming or dismiss overlay |
| `Enter` | Send message in Composer |
| `Shift + Enter` | Newline in multiline Composer |

---

## Development

```bash
# Install dependencies
npm install

# Run dev server on port 3000
npm run dev

# Run TypeScript type check
npm run typecheck

# Run unit tests
npx --yes tsx --test src/lib/logic.test.ts

# Production build
npm run build
```
