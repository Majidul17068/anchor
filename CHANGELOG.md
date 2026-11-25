# Changelog

## Unreleased (0.3.5)

- Automations, a new section in the rail. Give Anchor a task and a
  schedule (every hour, every day, chosen weekdays, or a cron expression)
  and it starts a fresh conversation with that prompt each time, nobody at
  the keyboard. Every run is kept as a normal session and listed in the
  automation's history with its result; *Run now* tries it at once.
  - You choose what a run may do without asking: look and report, change
    files in its folder, or also run commands. A run that needs more than
    it is allowed stops and says what it wanted.
  - A run missed while Anchor was closed is made up once at the next
    start, if the automation is set to.
  - *Keep running when I close the window* and *Start when I sign in* keep
    automations going without the window; starting Anchor again brings the
    window back (one copy only ever runs).
  - The Antigravity CLI's own automations can be brought into Anchor, and
    an Anchor automation exported in the CLI's format.
  - `anchorctl run "<prompt>"` does one unattended run from the terminal.

- Google Drive account: sign-in always shows Google's account chooser;
  *Change account* moves sync to another account without deleting
  anything; *Disconnect* signs out, withdraws Anchor's access at Google and
  clears every link to that Drive, so a device is never stuck on one
  account. Settings has the same Drive card as the Sync page, and the
  developer OAuth client section is hidden when the release carries one.
- Windows and Linux:
  - CLI install on Linux no longer needs curl and reports a failed
    download instead of "installer finished but agy was not found"; a
    missing bash is named.
  - Attached files reach the agent on Windows (file links were invalid
    for `C:\…` paths) and paths with spaces are encoded everywhere.
  - "Open folder" after publishing works on all three systems (the app's
    URL opener refuses file links; the system file manager is used).
  - Google Drive for Desktop on Windows is found on drive letters D to Z
    and in mirror mode, probed together so dead network drives do not
    stall detection; no console window flashes during health checks.
  - Linux no longer suggests installing Google's Drive client, which does
    not exist there.
  - Project names show correctly for Windows paths.
  - Sign-out reports a failure when the CLI is in fact still signed in.
  - The Linux download unpacks to a folder with `install.sh` (menu entry,
    icon, no root) and names the packages it needs.
- Safer marketplace installs: bundle entries cannot escape the install
  folder through `..`, backslashes or drive letters.

## 0.3.4 — It learns how you work, shows your limits, and reads like a chat should

- Learn from my work (Settings, off by default). Anchor studies your own
  messages from recent chats and proposes standing instructions for
  corrections you repeat, and draft skills or agents for work you repeat.
  Each proposal shows why, quoting your words, and exactly what it would
  add; you edit, approve or dismiss it, and nothing changes until you
  approve. Dismissed ideas are not proposed again. Approved skills and
  agents are yours and can be shared on the Marketplace from the same card.
  Studies run on demand or at most once a day; `anchorctl learn` does the
  same from the terminal.
- What Anchor learns follows you. With Google Drive connected, one file at
  the top of your Anchor folder (`Anchor knowledge.json`, beside the dated
  session folders) carries the suggestions, your decisions, your standing
  instructions and the skills and agents you approved. Every device pulls
  and pushes it in the background: a draft found on one device can be
  approved on another, an approved skill is created on each device once, a
  dismissal sticks everywhere, and instructions follow the device that
  changed them last.
- Replies render as real Markdown: tables, rules, nested and numbered
  lists, checklists.
- Paste or drop images and files into the composer; pictures show as
  thumbnails and reach the model as images; a very long paste becomes a
  text attachment.
- The chat header wraps instead of overlapping when the window is narrow.
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
