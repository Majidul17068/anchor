# Changelog

## 0.3.0 — Drive that tells the truth, delete that follows the parent rule

- Google Drive for Desktop folder handling never hangs: every folder
  operation runs under a deadline, and a folder whose Drive client is down
  shows as disconnected with the exact reason (Drive app uninstalled, Drive
  app not running with an *Open Google Drive* button, folder unreachable).
- Deleting a session on the device that created it (the parent source) also
  removes it from Google Drive, appends from other devices included. Other
  devices only drop their own copy and can pull the session again later.
- Pulling or refreshing a session includes additions other devices uploaded
  that the parent has not merged yet, so every device sees the latest
  conversation even while the parent is offline.
- Delete confirmations explain what will happen on this device and on Drive.
- `anchorctl drive` diagnoses Drive for Desktop from the terminal.
- The app bundle now carries the real version number.

## 0.2.x — November 12

- Sign-in, chat and delete fixes; visible `Anchor/YYYY/MM/DD` folder on
  Drive with pull-on-demand; Drive for Desktop folder as the default Drive
  route; Adapt Skill from GitHub; plan gating; agent test panel.

## 0.1.0 — first release

- Desktop shell for macOS, Windows and Linux (Wails v2, Go backend).
- Chat with the Antigravity CLI over the Agent Client Protocol: streaming
  answers, thinking, tool calls, permission prompts, edit diffs, cancel.
- Model, thinking level and mode per session; subscription tier badge from
  the CLI.
- History: every CLI conversation on the machine, full-text search, resume,
  Markdown export.
- Agents: create and edit agent definition files; plugin and built-in agents listed.
- Skills: editor with versions and rollback, Train (evaluate examples) and
  Improve, Drive sharing and import from link.
- Marketplace: GitHub-backed catalog, install, publish, requests, notifications.
- Sync: parent-source model over the user's Google Drive appDataFolder.
- `anchorctl` terminal companion.
- Zero-config onboarding: installs the CLI with Google's installer, Google
  sign-in through the CLI, device naming, optional Drive connection.
