"""Match small scenery and ground dots to the coarse marks of the village buildings."""
import argparse
import json
from pathlib import Path
from shutil import copyfile

from PIL import Image, ImageDraw

DOT = 4
DECOR_CELL = 32


def coarse_dots(source, *, keep_mask=False, sample_rows=None):
    """Sample existing colors on a fixed grid at the original PNG dimensions."""
    source = source.convert('RGBA')
    width, height = source.size
    result = Image.new('RGBA', source.size)
    draw = ImageDraw.Draw(result)
    pixels = source.load()
    fallback = None
    for y in range(0, height, DOT):
        for x in range(0, width, DOT):
            right, bottom = min(x + DOT, width), min(y + DOT, height)
            middle_x = min(x + DOT // 2, right - 1)
            middle_y = sample_rows[y] if sample_rows else min(y + DOT // 2, bottom - 1)
            visible = [
                (pixels[px, py], abs(px - middle_x) + abs(py - middle_y))
                for py in range(y, bottom)
                for px in range(x, right)
                if pixels[px, py][3] >= 128
            ]
            if not visible:
                continue
            color, _ = min(visible, key=lambda sample: sample[1])
            block = (x, y, right - 1, bottom - 1)
            if fallback is None or len(visible) > fallback[0]:
                fallback = len(visible), block, color
            if keep_mask or len(visible) * 4 >= (right - x) * (bottom - y):
                draw.rectangle(block, fill=color)
    if fallback and result.getbbox() is None:
        # A small falling petal must still be visible at this pitch.
        _, block, color = fallback
        draw.rectangle(block, fill=color)
    if keep_mask:
        result.putalpha(source.getchannel('A'))
    return result


def physalis_sway(plant, frames):
    width, height = plant.size
    _, top, _, bottom = plant.getchannel('A').getbbox()
    sheet = Image.new('RGBA', (width * frames, height))
    bends = (0, 3, 4, 3, 0, -3, -4, -3)
    if frames != len(bends):
        raise ValueError('The physalis animation needs eight frames')
    for frame, bend in enumerate(bends):
        pose = Image.new('RGBA', plant.size)
        for y in range(0, height, DOT):
            strength = max(0, min(1, (bottom - DOT - y) / (bottom - DOT - top)))
            band = plant.crop((0, y, width, min(y + DOT, height)))
            offset = round(bend * strength / DOT) * DOT
            if band.getbbox():
                left, _, right, _ = band.getbbox()
                if left + offset < 0 or right + offset > width:
                    offset = 0
            pose.paste(band, (offset, y))
        sheet.paste(pose, (frame * width, 0))
    return sheet


def plank_sample_rows(chip):
    """Alternate the face and the seam of the planks at the shared pitch."""
    def brightness(y):
        return sum(sum(chip.getpixel((x, y))[:3]) for x in range(16, 32))

    return {
        y: (max if (y // DOT) % 2 == 0 else min)(range(y, y + DOT), key=brightness)
        for y in range(0, chip.height, DOT)
    }


def export_terrain(source, target, scene):
    terrain = scene['terrain']
    with Image.open(source / terrain['atlas']) as original:
        atlas = original.convert('RGBA')
    tiles = terrain['tiles']
    bridge = scene['river']['bridgeTiles']
    bridge_rows = {}
    for left_id, right_id in zip(bridge[::2], bridge[1::2]):
        x, y, size = tiles[left_id]
        rows = plank_sample_rows(atlas.crop((x, y, x + size, y + size)))
        bridge_rows[left_id] = bridge_rows[right_id] = rows

    layers = {tile: layer['name'] for layer in terrain['layers'] for tile in layer['cells']
              if 0 <= tile < terrain['baseTileCount']}
    for tile, layer in sorted(layers.items()):
        x, y, size = tiles[tile]
        chip = atlas.crop((x, y, x + size, y + size))
        paint = coarse_dots(chip, keep_mask=True, sample_rows=bridge_rows.get(tile))
        if layer == 'river':
            paint.paste(paint.crop((0, 0, DOT, size)), (size - DOT, 0))
        atlas.paste(paint, (x, y))
    atlas.save(target / terrain['atlas'], optimize=True)


def export(source, target):
    if source.resolve() == target.resolve():
        raise ValueError('Use an unchanged source directory for the export')
    scene = json.loads((source / 'scene.json').read_text())
    sprites = {sprite['file']: sprite for sprite in scene['sprites']}
    copyfile(source / 'hizuki.png', target / 'hizuki.png')
    for name, sprite in sprites.items():
        if sprite.get('eave') or sprite['id'] == 'belltower':
            copyfile(source / name, target / name)
            continue
        with Image.open(source / name) as original:
            paint = coarse_dots(original)
        paint.save(target / name, optimize=True)
        if sprite.get('sway'):
            physalis_sway(paint, sprite['frames']).save(target / sprite['sway'], optimize=True)

    with Image.open(source / 'ground-decor.png') as original:
        decor = original.convert('RGBA')
    for index, width, height in sorted({(i, w, h) for i, _, _, w, h in scene['groundDecor']}):
        x, y = index % 8 * DECOR_CELL, index // 8 * DECOR_CELL
        chip = decor.crop((x, y, x + width, y + height))
        decor.paste(coarse_dots(chip), (x, y))
    decor.save(target / 'ground-decor.png', optimize=True)

    with Image.open(source / 'path-soil.png') as original:
        coarse_dots(original).save(target / 'path-soil.png', optimize=True)
    export_terrain(source, target, scene)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('target', type=Path)
    args = parser.parse_args()
    export(args.source, args.target)
