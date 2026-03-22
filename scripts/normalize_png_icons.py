#!/usr/bin/env python3
"""
Normalize PNG icons by cropping each image individually and exporting them as
256x256 transparent images.

Example:
    python scripts/normalize_png_icons.py --input-dir sandbox/site-wide-test --output-dir src/asset/new/normalized
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image


DEFAULT_INPUT_DIR = Path("src/asset/new")
DEFAULT_OUTPUT_DIR = Path("src/asset/new/normalized")
DEFAULT_SIZE = 256


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crop PNG icons to a shared content box and export square transparent images."
    )
    parser.add_argument(
        "--input-dir",
        default=str(DEFAULT_INPUT_DIR),
        help=f"Directory containing source PNG files (default: {DEFAULT_INPUT_DIR.as_posix()})",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Directory for normalized PNG files (default: {DEFAULT_OUTPUT_DIR.as_posix()})",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=DEFAULT_SIZE,
        help=f"Output square size in pixels (default: {DEFAULT_SIZE})",
    )
    return parser.parse_args()


def find_content_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return (0, 0, rgba.width, rgba.height)
    return bbox


def paste_centered(destination: Image.Image, source: Image.Image) -> None:
    x = (destination.width - source.width) // 2
    y = (destination.height - source.height) // 2
    destination.alpha_composite(source, (x, y))


def resize_to_square(source: Image.Image, size: int) -> Image.Image:
    scale = min(size / source.width, size / source.height)
    target_width = max(1, round(source.width * scale))
    target_height = max(1, round(source.height * scale))
    resized = source.resize((target_width, target_height), Image.Resampling.LANCZOS)

    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    paste_centered(square, resized)
    return square


def normalize_icons(input_dir: Path, output_dir: Path, size: int) -> int:
    source_paths = sorted(input_dir.glob("*.png"))
    if not source_paths:
        raise FileNotFoundError(f"no png files found in {input_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    for path in source_paths:
        with Image.open(path) as image:
            rgba = image.convert("RGBA")
            cropped = rgba.crop(find_content_bbox(rgba))

        normalized = resize_to_square(cropped, size)
        destination = output_dir / path.name
        normalized.save(destination)
        print(f"saved {destination.as_posix()} <- {path.as_posix()}")

    return len(source_paths)


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)

    try:
        count = normalize_icons(input_dir, output_dir, args.size)
    except Exception as exc:  # pragma: no cover - CLI failure path
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"normalized {count} png file(s)")
    print(f"output size: {args.size}x{args.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
