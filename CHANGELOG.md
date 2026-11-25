# Changelog

## Unreleased

- Usage limits are visible. A meter in the title bar shows the limit
  closest to running out; clicking it lists, for each model group, how much
  of the weekly and five-hour allowance is left and when it refills, plus
  remaining AI credits. Settings has the same under *Usage & Limits*, and
  `anchorctl usage` prints it. Numbers come from the CLI's own `/usage` and
  refresh after every turn.
- The chat header shows how full the model's context window is.
- Marketplace ratings work: your review and stars appear at once (marked
  as awaiting publication until the public catalog has them), a second
  review replaces the first, and opening a listing loads its reviews.

## 0.3.3 — Agents that run, a marketplace for agents and plugins, pull latest

- Agents created in Anchor work again. The Antigravity CLI silently skips
  any agent file whose `commandExecutionPolicy` is not `auto`; Anchor wrote
  `ask`, so Test and `--agent` could not find them. New files leave the key
  out, old files are repaired on the next listing, and a card shows "Not
  seen by CLI" if the CLI still does not list it.
- Opening a session from two places at once no longer breaks it ("closed
  while loading", then "session not found"): loads are serialised.
- Marketplace: publish your agents and plugins, not only skills. The Publish
  wizard chooses what to share; agent cards have a Share button; listings
  carry a kind badge; installing an agent puts it under your agents, a
  plugin goes through `agy plugin install`.
- Pull latest: a button in the chat header exchanges a synced session with
  Google Drive right away in both directions, so a chat started on one
  device, continued on another and picked up again shows everything, and
  the agent is told what was said elsewhere. The open transcript also
  reloads when the background sync merges another device's additions.
- The Sync page shows when the last synchronization happened, including
  after a restart; each session remembers when it was last synced.

## 0.3.2 — A first run worth watching, and rules the agent keeps

- Onboarding is a wizard: brand panel with a logo intro on the left, one
  step per screen on the right, Back and Next that work. Returning users
  who sign out get a single "Welcome back" sign-in screen instead.
- New "About you" step and matching Settings section: first and last name,
  device name with a Change button, and standing instructions the agent
  follows in every conversation (written to the CLI's global rules file, so
  terminal sessions follow them too).
- The avatar in the rail opens an account menu with Sign out.
- Sign out also disconnects Google Drive, so the next account starts clean.
- Settings hides the Drive client fields when the release already carries one.

## 0.3.1 — Drive for everyone, account name back

- Releases carry Anchor's Google OAuth client; the consent screen is in
  production, so any Google account can connect Google Drive with one click
  and nothing to install.
- Connect prefers the Drive API over a Drive for Desktop folder whose client
  is not running.
- The signed-in Google account is shown again with Antigravity CLI 1.5.15,
  which keeps its session in the OS keychain.
- Privacy policy added (docs/PRIVACY.md).

## 0.3.0 — Drive that tells the truth, delete that follows the parent rule

- Google Drive for Desktop folder handling never hangs: every folder
  operation runs under a deadline, and a folder whose Drive client is down
  shows as disconnected with the exact reason (Drive app uninstalled, Drive
  app not running with an *Open Google Drive* button, folder unreachable).
- Deleting a session on the device that created it (the parent source) also
  removes it from Google Drive, appends from other devices included, and a
  tombstone makes every other device drop its copy on its next sync. Other
  devices deleting a pulled copy only drop that copy and can pull again.
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
