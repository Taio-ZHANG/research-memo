"""Build a small-size list icon with individually pixel-aligned ICO frames."""

from io import BytesIO
from pathlib import Path
import struct

from PIL import Image, ImageDraw


def draw_icon(size):
    # Antialias the silhouette, but draw the white bars on the final pixel grid.
    scale = 4
    image = Image.new('RGBA', (size * scale, size * scale))
    draw = ImageDraw.Draw(image)
    pad = max(1, round(size / 16))
    draw.rounded_rectangle(
        (pad * scale, pad * scale, (size - pad) * scale - 1,
         (size - pad) * scale - 1),
        radius=round(size * 0.22 * scale), fill='#4b8de8',
    )
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)
    left = round(size * 0.25)
    right = size - left - 1
    thickness = max(2, round(size / 8))
    for center in (0.3125, 0.5, 0.6875):
        top = round(size * center - thickness / 2)
        draw.rectangle((left, top, right, top + thickness - 1), fill='white')
    return image


def main():
    # Include 125%, 150%, 175%, 200% and larger Windows scaling sizes.
    sizes = (16, 20, 24, 28, 32, 40, 48, 64, 256)
    frames = []
    for size in sizes:
        buffer = BytesIO()
        draw_icon(size).save(buffer, format='PNG')
        frames.append(buffer.getvalue())

    offset = 6 + 16 * len(frames)
    directory = bytearray(struct.pack('<HHH', 0, 1, len(frames)))
    for size, frame in zip(sizes, frames):
        directory.extend(struct.pack(
            '<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32,
            len(frame), offset,
        ))
        offset += len(frame)
    output = Path(__file__).with_name('tray-icon.ico')
    output.write_bytes(directory + b''.join(frames))
    print(f'Generated {output.name}: {", ".join(map(str, sizes))} px')


if __name__ == '__main__':
    main()
