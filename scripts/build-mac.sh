#!/usr/bin/env bash
# Local macOS build: compiles Anchor with Wails, signs it in a resource-fork-
# free location (Desktop/Documents folders add provenance attributes that make
# codesign refuse the bundle), and installs it into ~/Applications.
#
#   scripts/build-mac.sh [version]
#
# Signing: ad-hoc by default, which Gatekeeper warns about. Export
# APPLE_SIGNING_IDENTITY="Developer ID Application: Name (TEAMID)" to sign
# with a real certificate; add APPLE_ID, APPLE_TEAM_ID and APPLE_APP_PASSWORD
# (an app-specific password) to notarize as well. CI does the same from
# repository secrets; see .github/workflows/build.yml.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-0.0.0-local}"
export PATH="$PATH:$HOME/go/bin"
export ANCHOR_VERSION="$VERSION"   # the UI's title-bar version comes from the frontend build

# Google Drive OAuth client, baked in like the release workflow does. Taken
# from the environment, else from .env.local (ignored by git), else from the
# client pasted into Anchor's Settings on this machine (~/.anchor/settings.json).
if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi
if [ -z "${ANCHOR_GOOGLE_CLIENT_ID:-}" ] && [ -f "$HOME/.anchor/settings.json" ]; then
  ANCHOR_GOOGLE_CLIENT_ID=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('driveClientId',''))" "$HOME/.anchor/settings.json" 2>/dev/null || true)
  ANCHOR_GOOGLE_CLIENT_SECRET=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('driveClientSecret',''))" "$HOME/.anchor/settings.json" 2>/dev/null || true)
fi
DRIVE_FLAGS=""
if [ -n "${ANCHOR_GOOGLE_CLIENT_ID:-}" ]; then
  DRIVE_FLAGS="-X github.com/Majidul17068/anchor/internal/drive.BuildClientID=${ANCHOR_GOOGLE_CLIENT_ID} -X github.com/Majidul17068/anchor/internal/drive.BuildClientSecret=${ANCHOR_GOOGLE_CLIENT_SECRET:-}"
  echo "Drive OAuth client: baked in"
else
  echo "Drive OAuth client: none (set ANCHOR_GOOGLE_CLIENT_ID/SECRET, .env.local, or paste it in Settings)" >&2
fi

wails build -clean -ldflags "-X main.Version=${VERSION} ${DRIVE_FLAGS}" || true   # self-signing may fail on provenance-tracked folders
APP=$(ls -d build/bin/*.app | head -1)
[ -d "$APP" ] || { echo "build failed: no .app in build/bin" >&2; exit 1; }

STAGE=$(mktemp -d)
ditto --norsrc --noextattr --noqtn "$APP" "$STAGE/Anchor.app"

if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  codesign --force --deep --timestamp --options runtime \
    --entitlements build/darwin/entitlements.plist \
    --sign "$APPLE_SIGNING_IDENTITY" "$STAGE/Anchor.app"
else
  echo "APPLE_SIGNING_IDENTITY not set: ad-hoc signing (Gatekeeper will warn)" >&2
  codesign --force --deep --sign - "$STAGE/Anchor.app"
fi
codesign --verify --deep --strict "$STAGE/Anchor.app"

if [ -n "${APPLE_SIGNING_IDENTITY:-}" ] && [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ] && [ -n "${APPLE_APP_PASSWORD:-}" ]; then
  ZIP="$STAGE/Anchor.zip"
  ditto -c -k --keepParent "$STAGE/Anchor.app" "$ZIP"
  xcrun notarytool submit "$ZIP" --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD" --wait
  xcrun stapler staple "$STAGE/Anchor.app"
fi

mkdir -p "$HOME/Applications"
rm -rf "$HOME/Applications/Anchor.app"
ditto "$STAGE/Anchor.app" "$HOME/Applications/Anchor.app"
rm -rf "$STAGE"
echo "Installed: $HOME/Applications/Anchor.app (version ${VERSION})"
