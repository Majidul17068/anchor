#!/usr/bin/env bash
# Local macOS build: compiles Anchor with Wails, ad-hoc signs it in a
# resource-fork-free location (Desktop/Documents folders add provenance
# attributes that make codesign refuse the bundle), and installs it into
# ~/Applications. CI does the same on a clean runner; see .github/workflows.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-0.0.0-local}"
export PATH="$PATH:$HOME/go/bin"

wails build -clean -ldflags "-X main.Version=${VERSION}" || true   # self-signing may fail on provenance-tracked folders
APP=$(ls -d build/bin/*.app | head -1)
[ -d "$APP" ] || { echo "build failed: no .app in build/bin" >&2; exit 1; }

STAGE=$(mktemp -d)
ditto --norsrc --noextattr --noqtn "$APP" "$STAGE/Anchor.app"
codesign --force --deep --sign - "$STAGE/Anchor.app"
codesign --verify --deep --strict "$STAGE/Anchor.app"

mkdir -p "$HOME/Applications"
rm -rf "$HOME/Applications/Anchor.app"
ditto "$STAGE/Anchor.app" "$HOME/Applications/Anchor.app"
rm -rf "$STAGE"
echo "Installed: $HOME/Applications/Anchor.app (version ${VERSION})"
