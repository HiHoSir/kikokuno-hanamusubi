#!/usr/bin/env python3
"""Process three approved *candidate drawings* for the sea-cove visual review.

Usage:
  python tools/process-cove-gear-source.py --basket BASKET.png \
      --rope ROPE.png --net NET.png --out assets/sea-cove/objects

Requires Pillow (run separately; not a runtime dependency). Source artworks
are generated drawings supplied in the project conversation, NOT the previous
procedural shapes. Match a specific native sprite canvas and foot anchor;
never scale these sprites at game-render time. The final image's lower edge
is the object's foot anchor. This does not alter terrain/sea animations.
"""
import argparse
from pathlib import Path
from PIL import Image

SPEC = {
    'basket': ('fish-basket-80x74.png', (80, 74), (76, 72)),
    'rope': ('rope-coil-88x62.png', (88, 62), (84, 46)),
    'net': ('net-bundle-146x88.png', (146, 88), (136, 64)),
}

def process(source_path, output_path, canvas_size, maximum_art_size):
    im = Image.open(source_path).convert('RGBA')
    alpha = im.getchannel('A').point(lambda a: 255 if a >= 32 else 0)
    box = alpha.getbbox()
    if not box:
        raise ValueError('Original art is empty: ' + str(source_path))
    im = im.crop(box)
    # Drop near-transparent generation ghosts before box resampling.
    clean_alpha = im.getchannel('A').point(lambda a: 255 if a > 100 else 0)
    im.putalpha(clean_alpha)
    im.thumbnail(maximum_art_size, Image.Resampling.BOX)
    indexed = im.convert('RGB').quantize(colors=48,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE).convert('RGB')
    indexed.putalpha(im.getchannel('A'))
    final = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    dx = (canvas_size[0] - indexed.width)//2
    dy = canvas_size[1] - indexed.height - 1
    final.alpha_composite(indexed,(dx,dy))
    output_path.parent.mkdir(parents=True,exist_ok=True)
    final.save(output_path,optimize=True)
    print(f'{output_path}: RGBA {canvas_size}, opaque bbox {final.getbbox()}')


def main():
    parser=argparse.ArgumentParser()
    for kind in SPEC:
        parser.add_argument('--'+kind, type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args=parser.parse_args()
    for kind, (filename, canvas, size) in SPEC.items():
        process(getattr(args,kind),args.out/filename,canvas,size)

if __name__=='__main__':
    main()