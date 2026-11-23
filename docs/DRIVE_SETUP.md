# Google Drive sync

Anchor backs sessions up to each user's **own** Google Drive, in a visible
`Anchor/` folder filed by day. No Anchor server is involved. There are two
ways to reach Drive; the first needs no setup from anyone.

## Default: Google Drive for Desktop (no registration)

If [Google Drive for Desktop](https://www.google.com/drive/download/) is
installed and signed in, the user's Drive is a folder on the machine
(`~/Library/CloudStorage/GoogleDrive-<email>/My Drive` on macOS, a drive
letter such as `G:\My Drive` on Windows). **Connect Google Drive** finds it,
creates `Anchor/` inside it, and writes sessions there as plain files;
Google's own client uploads them. On another computer with Drive for
Desktop and the same account, the same folder is there and *Sync & Devices*
lists the sessions to pull.

Any folder another cloud client keeps in sync works the same way (Dropbox,
OneDrive, iCloud Drive): *Choose a synced folder…* points Anchor at it. The
chosen folder is remembered in `~/.anchor/settings.json` (`syncFolder`).

Drive for Desktop is not available on Linux; use another synced folder, or
the API route below.

### When Connect says Drive is unavailable

A Drive for Desktop folder is a network mount: when the Drive client is not
running, the folder still exists but every read hangs. Anchor never waits on
it; instead the Sync page shows one of these and what to do:

| Code | Meaning | Fix |
|---|---|---|
| `DRIVE_CLIENT_NOT_RUNNING` | Drive for Desktop is installed but not running | Click *Open Google Drive*, wait for it to sign in, then *Try again* |
| `DRIVE_CLIENT_MISSING` | The Drive folder is left over from an earlier install; the app was removed | Reinstall Drive for Desktop and sign in, then *Connect again* |
| `DRIVE_UNREACHABLE` | The chosen folder exists but does not answer | Check that its cloud client is running and signed in |
| `DRIVE_NOT_FOUND` | No synced folder on this machine | Install Drive for Desktop or *Choose a synced folder…* |

From the terminal, `anchorctl drive` prints the same diagnosis: whether the
Drive app is installed and running, every synced folder found, and whether
each one answers.

### Who may delete what

The device that created a session (its parent source) is the only one that
publishes, unpublishes or deletes it on Drive: deleting there removes the
canonical file and any additions other devices uploaded. Deleting a pulled
copy on another device removes only that copy; the session stays on Drive
and can be pulled again.

## Alternative: the Drive API (needs a one-time OAuth client)

Without a synced folder Anchor can talk to the Drive API directly, but
Google must know which application is asking, so the build must carry an
OAuth client id. The developer creates that client once, for free, in
Google Cloud Console; users never see it — they get Google's consent screen
on Connect and nothing else.

### 1. Create the OAuth client

1. Open <https://console.cloud.google.com/> and create a project (for example
   `anchor-desktop`).
2. **APIs & Services → Library**: enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: choose *External*, fill in the
   app name `Anchor`, support email, and developer contact. Under *Scopes*
   add:
   - `https://www.googleapis.com/auth/drive.appdata`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/userinfo.email`
4. While the app is in *Testing*, add the Google accounts that may use it
   under *Test users* (up to 100). Publish the app when you are ready for
   everyone; Google may ask for a short verification because `drive.file` is
   a sensitive scope.
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   application type **Desktop app**, name `Anchor desktop`. Copy the client id
   and client secret.

For installed (desktop) applications Google documents that the client secret
is not a confidential value; it only pairs with the client id. Anchor adds
PKCE on top and listens on a loopback port for the redirect.

## 2. Give the id to Anchor

Any of these work; the first match wins:

| Where | How |
|---|---|
| Settings (per machine) | Paste them into *Settings → Google Drive OAuth client* (stored as `driveClientId` / `driveClientSecret` in `~/.anchor/settings.json`). |
| Environment | `ANCHOR_GOOGLE_CLIENT_ID` and `ANCHOR_GOOGLE_CLIENT_SECRET` when launching Anchor. |
| Release builds | GitHub repository secrets `ANCHOR_GOOGLE_CLIENT_ID` and `ANCHOR_GOOGLE_CLIENT_SECRET`; the build workflow bakes them in with `-ldflags`. |

Without a client id, everything except Drive sync and skill sharing works,
and the Sync screen explains what is missing.

## 3. What goes to Drive

```
Anchor/                                         visible folder, created on first connect
  2026/11/12/
    <title> (<id>).json                         canonical transcript (parent source)
    <title> (<id>) - from <device>.json         steps added on a replica, until merged
  Shared skills/<skill>/                        one file per skill file
appDataFolder/                                  hidden, only Anchor can see it
  device-<id>.json                              name, platform, last seen
```

Session files are filed under the day the session was created and tagged
with app properties (`anchorKind`, `anchorSession`, `origin`, `anchorDay`,
`anchorTitle`, `anchorSteps`), which is how Anchor finds them wherever they
sit. Other devices do not download every published session: *Sync &
Devices → Sessions on Drive from other devices* lists them and the user
pulls the ones they want; pulled sessions then keep refreshing.

You grant access once; the refresh token lives in
`~/.anchor/drive-token.json` (mode 0600) and later launches reuse it.
*Disconnect Drive* deletes that file; nothing is removed from Drive.
