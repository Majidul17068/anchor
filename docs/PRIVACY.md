# Anchor privacy policy

_Last updated: 23 November 2026_

Anchor is a desktop application for macOS, Windows and Linux that works with
Google's Antigravity CLI. It is published by Majidul Islam at
<https://github.com/Majidul17068/anchor>. This policy explains what Anchor
does with your data. The short version: **Anchor has no servers. Your data
stays on your computer and, if you choose, in your own Google Drive.**

## What Anchor stores, and where

| Data | Where it lives | Why |
|---|---|---|
| Chat sessions, transcripts, titles | Your computer (`~/.anchor`) and the Antigravity CLI's own folder (`~/.gemini`) | So you can read and continue your conversations |
| Skills and agents you create | Your computer (`~/.gemini/config`) | So the Antigravity CLI can use them |
| Device name and a random device id | Your computer | To tell your devices apart when you sync |
| Sessions you switch **Sync** on for | An `Anchor` folder in **your own** Google Drive | So your other devices can pull them |
| A Google Drive access token | Your computer (`~/.anchor/drive-token.json`) | So Anchor can reach your Drive without asking again |

Anchor does not operate any server, database or analytics service. Nothing
you type is sent to the publisher of Anchor.

## Google account and Google Drive

- **Signing in to Google for AI** happens inside Google's Antigravity CLI,
  not in Anchor. Anchor never sees that password or token; it only reads the
  signed-in email address the CLI records so it can show who is signed in.
- **Connecting Google Drive** is optional. When you click *Connect Google
  Drive*, Google's own consent screen asks you to grant Anchor these
  permissions: `drive.file` (create and manage files Anchor itself creates),
  `drive.appdata` (a hidden app folder for device records) and
  `userinfo.email` (to show which account is connected). Anchor cannot see,
  read or change any other file in your Drive.
- Anchor writes only into the `Anchor` folder it creates in your Drive. You
  can delete that folder, or revoke Anchor's access at any time at
  <https://myaccount.google.com/permissions>; Anchor keeps working without Drive.
- Anchor's use and transfer of information received from Google APIs adheres
  to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
  including the Limited Use requirements.

## Sharing between people

Sharing a skill with another Google account uses Google Drive's own sharing,
from your Drive to theirs. The optional Anchor Marketplace is a public GitHub
repository; publishing a skill there is an explicit action that opens a
GitHub issue in your browser, and nothing is uploaded without that action.

## Third parties

Anchor talks to Google (the Antigravity CLI and, if connected, Google Drive)
and to GitHub (the marketplace index and update checks). Their privacy
policies apply to those services. Anchor includes no advertising and no
tracking.

## Children

Anchor is not directed at children under 13.

## Changes and contact

Changes to this policy are published at
<https://github.com/Majidul17068/anchor/blob/main/docs/PRIVACY.md>.
Questions: open an issue at <https://github.com/Majidul17068/anchor/issues>
or email majidulislam17068@gmail.com.
