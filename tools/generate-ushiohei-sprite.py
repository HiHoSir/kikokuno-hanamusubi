#!/usr/bin/env python3
"""Deterministically adapt the approved male village NPC into Ushiohei.

The starting asset is our own approved farm-worker sprite (NOT a copy from
Tengai Makyou ZERO). ZERO NPCs are consulted only for the restrained palette,
strong contour and 4-direction / 3-frame walk grammar.
Pure Python 3 stdlib: no third-party image tools or services needed.
"""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/characters/npc/farm-worker-walk-4dir-80x112.png"
OUTPUT = ROOT / "assets/characters/npc/ushiohei-walk-4dir-80x112.png"
W, H = 240, 448
FRAME_W, FRAME_H = 80, 112


def load_rgba(path):
    raw = path.read_bytes()
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"
    pos, payload, width, height = 8, bytearray(), 0, 0
    while pos < len(raw):
        length = struct.unpack_from(">I", raw, pos)[0]
        name = raw[pos + 4:pos + 8]
        chunk = raw[pos + 8:pos + 8 + length]
        pos += 12 + length
        if name == b"IHDR":
            width, height, bits, color, compression, filter_method, interlace = struct.unpack(">IIBBBBB", chunk)
            assert (bits, color, compression, filter_method, interlace) == (8, 6, 0, 0, 0)
        elif name == b"IDAT":
            payload.extend(chunk)
        elif name == b"IEND":
            break
    assert (width, height) == (W, H), (width, height)
    decompressed = zlib.decompress(payload)
    stride = W * 4
    rows = []
    offset = 0
    prev = bytearray(stride)
    for y in range(H):
        kind = decompressed[offset]
        offset += 1
        scan = bytearray(decompressed[offset:offset + stride])
        offset += stride
        for i in range(stride):
            a = scan[i - 4] if i >= 4 else 0
            b = prev[i]
            c = prev[i - 4] if i >= 4 else 0
            if kind == 1:
                predictor = a
            elif kind == 2:
                predictor = b
            elif kind == 3:
                predictor = (a + b) // 2
            elif kind == 4:
                p = a + b - c
                da, db, dc = abs(p-a), abs(p-b), abs(p-c)
                predictor = a if da <= db and da <= dc else b if db <= dc else c
            elif kind == 0:
                predictor = 0
            else:
                raise ValueError("unsupported PNG filter " + str(kind))
            scan[i] = (scan[i] + predictor) & 255
        rows.append(scan)
        prev = scan
    return rows


def color_for_sailcloth(r, g, b):
    # Use tonal contrast from the approved source, not flat fill.
    luminance = (r * 3 + g * 5 + b * 2) / 10
    return (
        int(18 + luminance * .27),
        int(34 + luminance * .51),
        int(49 + luminance * .61)
    )


def paint():
    rows = load_rgba(SOURCE)
    original = [bytes(row) for row in rows]
    result = 0
    for y, row in enumerate(rows):
        ly = y % FRAME_H
        for x in range(W):
            lx = x % FRAME_W
            i = x * 4
            r, g, b, a = original[y][i:i+4]
            if a < 90:
                continue
            is_skin = r > 112 and g > 67 and r - g > 22 and g - b > 15
            dark_outline = max(r,g,b) < 34
            is_cloth = 44 <= ly <= 84 and not is_skin and not dark_outline
            if is_cloth and r > b * 1.08 and r >= g * .96:
                rr, gg, bb = color_for_sailcloth(r,g,b)
                row[i:i+3] = bytes((rr,gg,bb))
                result += 1
            # Indigo binding around the broad original straw kasa.
            if 31 <= ly <= 33 and 25 <= lx <= 55 and a > 140 and not is_skin:
                row[i:i+3] = bytes((49,81,91)) if (lx + ly) % 5 else bytes((66,108,117))
            # Off-white rope across the torso. Only recolor source silhouette,
            # so this never invents new frame width / alpha edges.
            if 65 <= ly <= 67 and 33 <= lx <= 47 and a > 190 and not is_skin:
                row[i:i+3] = bytes((179,170,138)) if ly == 65 else bytes((222,211,169))
            # Sleeve-cuff accents are small and stay inside the original arms.
            if 62 <= ly <= 65 and (23 <= lx <= 28 or 52 <= lx <= 57) and a > 180 and not is_skin:
                row[i:i+3] = bytes((170,165,140))
    # Hand-authored fishing-knot / net charm on the apron (front and back).
    # Coordinates are per 80x112 cell, same relative details across 3 frames.
    # All edits are clipped to opaque original pixels; no sprite discontinuity.
    for direction in range(4):
        for frame in range(3):
            xo, yo = frame * FRAME_W, direction * FRAME_H
            for dx, dy, color in (
                (-3,0,(207,202,167)),(-2,0,(211,208,179)),
                (-1,1,(160,174,155)),(0,2,(203,211,182)),
                (1,1,(153,180,169)),(2,0,(205,210,189)),
                (-2,3,(125,160,156)),(2,3,(125,160,156))
            ):
                x, y = xo + 40 + dx, yo + 56 + dy
                i = x * 4
                if rows[y][i+3] > 190:
                    rows[y][i:i+3] = bytes(color)
    print(f"Edited {result} outfit pixels from approved male sprite; {W}x{H}, 12 frames")
    return rows


def write_rgba(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    scan = bytearray()
    for row in rows:
        scan.append(0)
        scan.extend(row)
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(scan, 9))
    data += chunk(b"IEND", b"")
    path.write_bytes(data)


if __name__ == "__main__":
    write_rgba(OUTPUT, paint())
    print("Wrote", OUTPUT.relative_to(ROOT), OUTPUT.stat().st_size, "bytes")
