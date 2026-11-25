#!/usr/bin/env bash
# Installs Anchor for the current user: the app and its terminal companion
# into ~/.local/bin, a menu entry and an icon. No root needed.
#
#   tar xzf anchor-linux-amd64.tar.gz && cd anchor && ./install.sh
#
# Remove it again with ./install.sh --uninstall
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="${XDG_BIN_HOME:-$HOME/.local/bin}"
data="${XDG_DATA_HOME:-$HOME/.local/share}"

if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$bin/anchor" "$bin/anchorctl" "$data/applications/anchor.desktop" "$data/icons/hicolor/512x512/apps/anchor.png"
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$data/applications" >/dev/null 2>&1 || true
  echo "Anchor removed. Your data in ~/.anchor was left alone."
  exit 0
fi

# Anchor's window is drawn by WebKitGTK 4.1; say so now rather than fail
# with a linker error on first launch.
if command -v ldconfig >/dev/null 2>&1 && ! ldconfig -p 2>/dev/null | grep -q 'libwebkit2gtk-4\.1\.so'; then
  echo "Anchor needs WebKitGTK 4.1, which was not found. Install it first:"
  echo "  Debian / Ubuntu:  sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0"
  echo "  Fedora:           sudo dnf install webkit2gtk4.1 gtk3"
  echo "  Arch:             sudo pacman -S webkit2gtk-4.1 gtk3"
  echo "  openSUSE:         sudo zypper install libwebkit2gtk-4_1-0 gtk3"
  echo "Then run this script again."
  exit 1
fi

mkdir -p "$bin" "$data/applications" "$data/icons/hicolor/512x512/apps"
install -m 0755 "$here/Anchor" "$bin/anchor"
install -m 0755 "$here/anchorctl" "$bin/anchorctl"
install -m 0644 "$here/anchor.png" "$data/icons/hicolor/512x512/apps/anchor.png"
sed "s|^Exec=anchor$|Exec=$bin/anchor|" "$here/anchor.desktop" > "$data/applications/anchor.desktop"
chmod 0644 "$data/applications/anchor.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$data/applications" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q "$data/icons/hicolor" >/dev/null 2>&1 || true

echo "Anchor is installed. Find it in your application menu, or run: $bin/anchor"
case ":$PATH:" in *":$bin:"*) ;; *) echo "Note: $bin is not on your PATH; add it to run 'anchor' from a terminal." ;; esac
