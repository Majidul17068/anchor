#!/usr/bin/env python3
"""Render the Anchor app icon (anchor glyph on an indigo tile) as a PNG using
only the standard library, so the repo has no binary-asset toolchain.

Usage: python3 scripts/make_icon.py build/appicon.png [size]
"""
import math
import struct
import sys
import zlib

SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
OUT = sys.argv[1] if len(sys.argv) > 1 else "build/appicon.png"

BG = (0x16, 0x17, 0x1D)
TILE = (0x6C, 0x5C, 0xE7)
TILE_DARK = (0x4F, 0x43, 0xC9)
FG = (0xFF, 0xFF, 0xFF)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded_rect(x, y, w, h, r):
    """Signed distance helper: returns True when (x, y) is inside the tile."""
    cx = min(max(x, r), w - r)
    cy = min(max(y, r), h - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def glyph_alpha(px, py, s):
    """Coverage of the anchor glyph at pixel (px, py) for tile size s."""
    # Geometry in a 24x24 design grid (matches the UI favicon).
    gx = px / s * 24
    gy = py / s * 24
    stroke = 2.2
    half = stroke / 2
    d = 1e9
    # ring
    rr = math.hypot(gx - 12, gy - 5)
    d = min(d, abs(rr - 3))
    # vertical bar 12,8 -> 12,21
    if 8 <= gy <= 21:
        d = min(d, abs(gx - 12))
    else:
        d = min(d, math.hypot(gx - 12, gy - (8 if gy < 8 else 21)))
    # horizontal bar 5,12 -> 19,12
    if 5 <= gx <= 19:
        d = min(d, abs(gy - 12))
    else:
        d = min(d, math.hypot(gx - (5 if gx < 5 else 19), gy - 12))
    # bottom arc: circle centre (12,12) radius 7, lower half only
    ar = math.hypot(gx - 12, gy - 12)
    if gy >= 12:
        d = min(d, abs(ar - 7))
    else:
        d = min(d, math.hypot(gx - (5 if gx < 12 else 19), gy - 12))
    # anti-aliased edge
    aa = 24 / s * 1.2
    t = (half + aa / 2 - d) / aa
    return max(0.0, min(1.0, t))


def render(size):
    rows = []
    pad = int(size * 0.08)
    tile = size - 2 * pad
    radius = tile * 0.22
    for y in range(size):
        row = bytearray()
        for x in range(size):
            tx, ty = x - pad, y - pad
            inside = 0 <= tx < tile and 0 <= ty < tile and rounded_rect(tx, ty, tile, tile, radius)
            if not inside:
                row += bytes((0, 0, 0, 0))
                continue
            base = lerp(TILE, TILE_DARK, ty / tile)
            a = glyph_alpha(tx, ty, tile)
            col = lerp(base, FG, a)
            row += bytes(col + (255,))
        rows.append(bytes(row))
    return rows


def png(rows, size):
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    data = png(render(SIZE), SIZE)
    with open(OUT, "wb") as f:
        f.write(data)
    print(f"wrote {OUT} ({SIZE}x{SIZE}, {len(data)} bytes)")
