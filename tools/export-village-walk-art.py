"""Export the village's placed art at its existing size, with a consistent pixel pitch."""
import argparse
import json
from pathlib import Path
from random import Random

from PIL import Image, ImageEnhance

OBJECT_COLORS = {
    'house-tile.png': 56,
    'house-thatch.png': 56,
    'teahouse.png': 64,
    'inn.png': 64,
    'belltower.png': 56,
    'sprite-08.png': 38,
    'sprite-46.png': 32,
    'sprite-36.png': 12,
    'sprite-60.png': 12,
}
PHYSALIS_FILES = (
    ('sprite-53.png', 'sprite-54.png'),
    ('sprite-55.png', 'sprite-56.png'),
    ('sprite-57.png', 'sprite-58.png'),
)


def paint_pixels(source, pitch):
    """Average covered pixels in each cell, excluding transparent RGB."""
    source = source.convert('RGBA')
    w, h = source.size
    pixels = source.load()
    samples = Image.new('RGB', ((w + pitch - 1) // pitch, (h + pitch - 1) // pitch))
    sample_pixels = samples.load()
    covered = []
    for top in range(0, h, pitch):
        for left in range(0, w, pitch):
            visible = [
                pixels[x, y]
                for y in range(top, min(top + pitch, h))
                for x in range(left, min(left + pitch, w))
                if pixels[x, y][3] >= 128
            ]
            if visible:
                color = tuple(round(sum(p[i] for p in visible) / len(visible)) for i in range(3))
                sample_pixels[left // pitch, top // pitch] = color
                covered.append(color)
    return samples, covered


def pixel_palette(colors, count):
    swatch = Image.new('RGB', (len(colors), 1))
    swatch.putdata(colors)
    return swatch.quantize(count, method=Image.Quantize.MEDIANCUT)


def export_frame(source, colors, *, pitch=2, saturation=1, palette=None):
    """Use flat color cells with the original silhouette and no dithering."""
    source = source.convert('RGBA')
    alpha = source.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    if not alpha.getbbox():
        return Image.new('RGBA', source.size)
    if saturation != 1:
        source = ImageEnhance.Color(source).enhance(saturation)
    samples, covered = paint_pixels(source, pitch)
    if palette is None:
        palette = pixel_palette(covered, colors)
    paint = samples.quantize(palette=palette, dither=Image.Dither.NONE).convert('RGB')
    image = paint.resize((paint.width * pitch, paint.height * pitch), Image.Resampling.NEAREST)
    image = image.crop((0, 0, source.width, source.height)).convert('RGBA')
    image.putalpha(alpha)
    return image


def road_texture(size):
    """Draw sparse flat dirt marks on the same two-pixel pitch as the scenery."""
    w, h = (n // 2 for n in size)
    dirt = Image.new('RGB', (w, h), '#d9ab76')
    pixels = dirt.load()
    random = Random(104)
    shapes = (
        ((0, 0), (1, 0)),
        ((0, 0), (1, 0), (1, 1)),
        ((0, 0), (1, 0), (2, 0), (0, 1), (1, 1)),
        ((0, 0), (1, 0), (2, 0), (1, 1), (2, 1), (3, 1)),
    )
    colors = ((209, 161, 110), (212, 165, 113), (223, 177, 126), (228, 185, 134))
    for _ in range(w * h // 18):
        x, y = random.randrange(w), random.randrange(h)
        color = random.choice(colors)
        for dx, dy in random.choice(shapes):
            pixels[(x + dx) % w, (y + dy) % h] = color
    for _ in range(w * h // 350):
        x, y = random.randrange(w), random.randrange(h)
        pixels[x, y] = (237, 195, 143)
        pixels[(x + 1) % w, y] = (231, 186, 134)
        pixels[(x + 1) % w, (y + 1) % h] = (192, 145, 96)
    return dirt.resize(size, Image.Resampling.NEAREST)


def physalis_sway(plant):
    """Move whole color cells from the standing plant and hold the root still."""
    width, height = plant.size
    _, top, _, bottom = plant.getchannel('A').getbbox()
    sheet = Image.new('RGBA', (width * 8, height))
    for frame, bend in enumerate((0, 2, 3, 2, 0, -2, -3, -2)):
        pose = Image.new('RGBA', plant.size)
        for y in range(0, height, 2):
            strength = max(0, min(1, (bottom - 4 - y) / (bottom - 4 - top)))
            offset = round(bend * strength / 2) * 2
            band = plant.crop((0, y, width, y + 2))
            pose.paste(band, (offset, y))
        sheet.paste(pose, (frame * width, 0))
    return sheet


def foliage_colors(chip):
    colors = chip.convert('RGBA')
    pixels = colors.load()
    for y in range(colors.height):
        for x in range(colors.width):
            red, green, blue, alpha = pixels[x, y]
            if green > max(red, blue):
                pixels[x, y] = (round(red + .25 * (green - red)), round(green * .94), blue, alpha)
    return colors


def join_water_edges(chip):
    """Blend the repeating sides before picking the shared river colors."""
    pixels = chip.load()
    right = chip.width - 2
    for y in range(chip.height):
        edge = [pixels[x, y] for x in (0, 1, right, right + 1)]
        if all(a >= 128 for _, _, _, a in edge):
            color = tuple(round(sum(p[i] for p in edge) / 4) for i in range(3))
            for x in (0, 1, right, right + 1):
                pixels[x, y] = (*color, pixels[x, y][3])


def export(source, target):
    if source.resolve() == target.resolve():
        raise ValueError('Use an unchanged source directory for the export')
    for filename, colors in OBJECT_COLORS.items():
        with Image.open(source / filename) as original:
            artwork = export_frame(original, colors, saturation=.92)
            if filename == 'belltower.png':
                # The small bronze bell needs its own ramp beside the wood and blue roof.
                bell = (170, 150, 262, 256)
                artwork.paste(export_frame(original.crop(bell), 12, saturation=.92), bell[:2])
            artwork.save(target / filename, optimize=True)

    fruit_colors = 32
    fruit_samples = []
    for pair in PHYSALIS_FILES:
        for filename in pair:
            with Image.open(source / filename) as original:
                fruit_samples.extend(paint_pixels(ImageEnhance.Color(original.convert('RGBA')).enhance(.88), 2)[1])
    fruit_palette = pixel_palette(fruit_samples, fruit_colors)
    for still, sway in PHYSALIS_FILES:
        with Image.open(source / still) as original:
            plant = export_frame(original, fruit_colors, saturation=.88, palette=fruit_palette)
        plant.save(target / still, optimize=True)
        physalis_sway(plant).save(target / sway, optimize=True)

    with Image.open(source / 'ground-decor.png') as original:
        decor = Image.new('RGBA', original.size)
        for top in range(0, original.height, 32):
            for left in range(0, original.width, 32):
                chip = original.crop((left, top, left+32, top+32))
                index = top // 32 * (original.width // 32) + left // 32
                if index < 58:
                    chip = foliage_colors(chip)
                pitch = 2 if 58 <= index < 65 else 1
                decor.paste(export_frame(chip, 14, pitch=pitch, saturation=.88), (left, top))
        decor.save(target / 'ground-decor.png', optimize=True)

    with Image.open(source / 'path-soil.png') as original:
        road_texture(original.size).save(target / 'path-soil.png', optimize=True)

    scene = json.loads((source / 'scene.json').read_text())
    terrain = scene['terrain']
    with Image.open(source / terrain['atlas']) as original:
        atlas = original.convert('RGBA')
    tiles = terrain['tiles']
    palettes = {'grass': 10, 'field': 20, 'river': 12, 'bridge': 18}
    saturation = {'grass': .9, 'field': .92, 'river': .82, 'bridge': .92}
    for name, colors in palettes.items():
        ids = {
            tile
            for layer in terrain['layers'] if layer['name'] == name
            for tile in layer['cells'] if 0 <= tile < terrain['baseTileCount']
        }
        chips = {}
        samples = []
        for tile in sorted(ids):
            left, top, size = tiles[tile]
            chip = atlas.crop((left, top, left+size, top+size))
            if name == 'river':
                join_water_edges(chip)
            chips[tile] = chip
            samples.extend(paint_pixels(ImageEnhance.Color(chip).enhance(saturation[name]), 2)[1])
        palette = pixel_palette(samples, colors)
        for tile, chip in chips.items():
            atlas.paste(export_frame(chip, colors, saturation=saturation[name], palette=palette),
                        tuple(tiles[tile][:2]))
    atlas.save(target / terrain['atlas'], optimize=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('target', type=Path)
    args = parser.parse_args()
    export(args.source, args.target)
