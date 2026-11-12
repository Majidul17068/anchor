# Google Drive sync: one-time OAuth setup

Anchor stores synced sessions in each user's **own** Google Drive, inside the
hidden `appDataFolder`, and shares skills through a visible `Anchor/Shared
skills` folder. No Anchor server is involved. Google still needs to know which
application is asking, so a release of Anchor must carry an OAuth client id.

You create that client once, for free, in Google Cloud Console. Every user of
your builds then signs in with their own account; the client id only
identifies the app.

## 1. Create the OAuth client

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
appDataFolder/                       hidden, only Anchor can see it
  device-<id>.json                   name, platform, last seen
  session-<id>.json                  canonical transcript (parent source)
  session-<id>.append-<device>.json  steps added on a replica, until merged
Anchor/Shared skills/<skill>/        visible folder, one file per skill file
```

Tokens live in `~/.anchor/drive-token.json` (mode 0600). *Disconnect Drive*
deletes that file; nothing is removed from Drive.
