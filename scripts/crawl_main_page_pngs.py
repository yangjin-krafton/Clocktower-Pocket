#!/usr/bin/env python3
"""
Crawl PNG images from the Blood on the Clocktower wiki Main Page.

Default usage:
    python scripts/crawl_main_page_pngs.py
"""

from __future__ import annotations

import argparse
import os
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen


DEFAULT_PAGE_URL = "https://wiki.bloodontheclocktower.com/Main_Page"
DEFAULT_OUTPUT_DIR = Path("src/asset/new")
USER_AGENT = "Clocktower-Pocket asset crawler/1.0"


class PngImageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.png_urls: list[str] = []
        self._div_depth = 0
        self._content_div_depths: list[int] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)

        if tag.lower() == "div":
            element_id = attr_map.get("id", "")
            classes = set((attr_map.get("class") or "").split())
            self._div_depth += 1
            if element_id == "mw-content-text" or "mw-parser-output" in classes:
                self._content_div_depths.append(self._div_depth)

        if tag.lower() != "img":
            return

        if not self._content_div_depths:
            return

        src = attr_map.get("src")
        if not src:
            return

        if urlparse(src).path.lower().endswith(".png"):
            self.png_urls.append(src)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "div":
            return

        if self._content_div_depths and self._content_div_depths[-1] == self._div_depth:
            self._content_div_depths.pop()

        if self._div_depth > 0:
            self._div_depth -= 1


def fetch_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request) as response:
        return response.read()


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def unique_preserve_order(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def build_filename(image_url: str) -> str:
    parsed = urlparse(image_url)
    raw_name = Path(unquote(parsed.path)).name
    if raw_name:
        return raw_name
    return "image.png"


def download_pngs(page_url: str, output_dir: Path) -> int:
    html = fetch_text(page_url)
    parser = PngImageParser()
    parser.feed(html)

    absolute_urls = unique_preserve_order(
        urljoin(page_url, image_url) for image_url in parser.png_urls
    )

    output_dir.mkdir(parents=True, exist_ok=True)

    for image_url in absolute_urls:
        filename = build_filename(image_url)
        destination = output_dir / filename
        image_bytes = fetch_bytes(image_url)
        destination.write_bytes(image_bytes)
        print(f"saved {destination.as_posix()} <- {image_url}")

    return len(absolute_urls)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download all PNG images referenced by a wiki page."
    )
    parser.add_argument(
        "--page-url",
        default=DEFAULT_PAGE_URL,
        help=f"Page to crawl (default: {DEFAULT_PAGE_URL})",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Directory to save PNG files into (default: {DEFAULT_OUTPUT_DIR.as_posix()})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    page_url = args.page_url
    output_dir = Path(args.output_dir)

    try:
        count = download_pngs(page_url, output_dir)
    except Exception as exc:  # pragma: no cover - CLI failure path
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"downloaded {count} png file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
