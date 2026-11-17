#!/usr/bin/env python3
"""Rebuild the village furniture atlas from the approved logical-pixel master.

Usage: python tools/build-interior-furniture.py [--check]

The 448x352 source is hand-reviewable at one *logical* pixel per 2 world
pixels; a 2x nearest-neighbour expansion exports the runtime 896x704 atlas.
There is no per-sprite stretch, canvas-time scaling, or palette reduction.
All 16 sprite rectangles are defined in src/game/interiors/rooms.mjs.
"""
from argparse import ArgumentParser
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'source-assets/village/interiors/furniture-master.png'
OUTPUT = ROOT/'assets/village/interiors/furniture.png'


def build():
    with Image.open(SOURCE) as original:
        master = original.convert('RGBA')
    if master.size != (448,352):
        raise ValueError(f'Unexpected master size {master.size}; expected 448x352')
    return master.resize((896,704), Image.Resampling.NEAREST)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='compare the committed atlas to the master')
    args = parser.parse_args()
    output = build()
    if args.check:
        with Image.open(OUTPUT) as source:
            actual = source.convert('RGBA')
        if actual.size != output.size or actual.tobytes() != output.tobytes():
            raise SystemExit('Furniture atlas differs from 2x nearest-neighbour master')
        print('PASS: 16 furniture sprites match 2x pixel master')
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        output.save(OUTPUT,optimize=True)
        print(f'Wrote {OUTPUT} {output.size}')


if __name__ == '__main__':
    main()