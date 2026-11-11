"""Apply the village's shared scenery palette without altering art geometry."""
import argparse
import json
from collections import Counter
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageColor

# Shared inks and ramps for the whole scene. Adjacent materials reuse these colors.
SCENE_COLORS = (
    '#2b2732', '#3c333e', '#514650', '#685962', '#847078', '#a48d8c',
    '#292f38', '#343f55', '#43536d', '#52617c', '#61718b', '#76839b', '#8e9caf', '#b0bac5',
    '#34303e', '#463b50', '#594a64', '#6d5c78', '#847189', '#a28a9c',
    '#44352f', '#594235', '#75533d', '#906747', '#9d6d49', '#ad7950',
    '#bc8759', '#c49764',
    '#cfa26f', '#d4a773', '#d8ac79', '#ddaf7e', '#e1b482', '#e6b98a',
    '#e9c69c', '#edd7b3', '#f1e0c6',
    '#4a4444', '#5e5551', '#756a62', '#8b7e72', '#a49685',
    '#bfb09b', '#d5c6af', '#e4d6c0',
    '#2d372b', '#34433a', '#41564a', '#4f6653', '#627a5c',
    '#394a2d', '#4d5b34', '#5c6939', '#687840', '#738543',
    '#7a9247', '#819648', '#869849', '#8a9b4b', '#8e9e4d',
    '#99a55a', '#a9af65', '#bbba76',
    '#663a3f', '#813f38', '#a14c3d', '#b85c41', '#c66538', '#d8763b', '#e5904b', '#e9aa6c',
    '#794656', '#985568', '#b46c7d', '#cf8793', '#e2a5aa', '#efbfbd', '#f5d7ce',
    '#294761', '#305977', '#275f97', '#286ba7', '#2c76b2',
    '#3584ba', '#4393c1', '#58a1c5', '#6ab1ca',
)


def srgb_linear(channel):
    channel /= 255
    return channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4


def perceptual_color(rgb):
    red, green, blue = map(srgb_linear, rgb)
    l = (.4122214708 * red + .5363325363 * green + .0514459929 * blue) ** (1 / 3)
    m = (.2119034982 * red + .6806995451 * green + .1073969566 * blue) ** (1 / 3)
    s = (.0883024619 * red + .2817188376 * green + .6299787005 * blue) ** (1 / 3)
    return (
        .2104542553 * l + .7936177850 * m - .0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + .4505937099 * s,
        .0259040371 * l + .7827717662 * m - .8086757660 * s,
    )


PALETTE = tuple(ImageColor.getrgb(color) for color in SCENE_COLORS)
PALETTE_LAB = tuple((perceptual_color(color), color) for color in PALETTE)


@lru_cache(maxsize=65536)
def scene_color(red, green, blue):
    light, a, b = perceptual_color((red, green, blue))
    # Reserve the strongest dark-to-light range for Hizuki, the moving focus.
    light = .92 * light + .042
    a *= .94
    b *= .96
    return min(PALETTE_LAB, key=lambda p: (
        (p[0][0] - light) ** 2 + 1.45 * (p[0][1] - a) ** 2 + 1.45 * (p[0][2] - b) ** 2
    ))[1]


def style(image):
    image = image.convert('RGBA')
    image.putdata([
        (*scene_color(red, green, blue), alpha) if alpha else (0, 0, 0, 0)
        for red, green, blue, alpha in image.get_flattened_data()
    ])
    return image


def flatten_shading(image):
    """Join isolated neighboring shade cells while preserving edges and accents."""
    cells = image.load()
    output = image.copy()
    out = output.load()
    for y in range(2, image.height - 3, 2):
        for x in range(2, image.width - 3, 2):
            center = cells[x, y]
            if center[3] != 255 or any(cells[x+dx, y+dy] != center for dx, dy in ((1, 0), (0, 1), (1, 1))):
                continue
            neighbors = Counter(cells[x+dx, y+dy] for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)))
            shade, votes = neighbors.most_common(1)[0]
            if votes < 3 or shade[3] != 255 or max(abs(a-b) for a, b in zip(center[:3], shade[:3])) > 28:
                continue
            for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
                out[x+dx, y+dy] = shade
    return output


def physalis_sway(plant):
    width, height = plant.size
    _, top, _, bottom = plant.getchannel('A').getbbox()
    sheet = Image.new('RGBA', (width * 8, height))
    for frame, bend in enumerate((0, 2, 3, 2, 0, -2, -3, -2)):
        pose = Image.new('RGBA', plant.size)
        for y in range(0, height, 2):
            strength = max(0, min(1, (bottom - 4 - y) / (bottom - 4 - top)))
            offset = round(bend * strength / 2) * 2
            pose.paste(plant.crop((0, y, width, y + 2)), (offset, y))
        sheet.paste(pose, (frame * width, 0))
    return sheet


def export(source, target):
    if source.resolve() == target.resolve():
        raise ValueError('Use an unchanged source directory for the export')
    scene = json.loads((source / 'scene.json').read_text())
    objects = {
        sprite[key]
        for sprite in scene['sprites']
        for key in ('file', 'eave')
        if key in sprite
    }
    sway = {sprite['file']: sprite['sway'] for sprite in scene['sprites'] if 'sway' in sprite}
    for filename in sorted(objects | {scene['terrain']['atlas'], 'ground-decor.png', 'path-soil.png'}):
        with Image.open(source / filename) as original:
            artwork = style(original)
        if filename in objects:
            artwork = flatten_shading(artwork)
        artwork.save(target / filename, optimize=True)
        if filename in sway:
            physalis_sway(artwork).save(target / sway[filename], optimize=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('target', type=Path)
    args = parser.parse_args()
    export(args.source, args.target)
