#!/usr/bin/env python3
"""
Download PNG images used across the Blood on the Clocktower wiki.

Examples:
    python scripts/crawl_main_page_pngs.py
    python scripts/crawl_main_page_pngs.py --recursive --max-pages 50
    python scripts/crawl_main_page_pngs.py --site-wide --output-dir src/asset/wiki
"""

from __future__ import annotations

import argparse
import sys
from collections import deque
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, unquote, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen


DEFAULT_PAGE_URL = "https://wiki.bloodontheclocktower.com/Main_Page"
DEFAULT_OUTPUT_DIR = Path("src/asset/new")
SITE_ROOT = "https://wiki.bloodontheclocktower.com/"
SITE_HOST = urlparse(SITE_ROOT).netloc
USER_AGENT = "Clocktower-Pocket asset crawler/1.0"
EXCLUDED_PREFIXES = (
    "Special:",
    "File:",
    "Category:",
    "Template:",
    "Help:",
    "User:",
    "MediaWiki:",
    "Talk:",
)


class WikiContentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.png_urls: list[str] = []
        self.page_urls: list[str] = []
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

        if not self._content_div_depths:
            return

        if tag.lower() == "a":
            href = attr_map.get("href")
            if href:
                self.page_urls.append(href)
            return

        if tag.lower() != "img":
            return

        src = attr_map.get("src")
        if src and urlparse(src).path.lower().endswith(".png"):
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
    return raw_name or "image.png"


def normalize_image_url(base_url: str, maybe_relative_url: str) -> str | None:
    absolute_url = urljoin(base_url, maybe_relative_url)
    parsed = urlparse(absolute_url)
    if parsed.scheme not in {"http", "https"}:
        return None
    if parsed.netloc != SITE_HOST:
        return None
    if not parsed.path.lower().endswith(".png"):
        return None
    return urlunparse(parsed._replace(fragment=""))


def normalize_page_url(base_url: str, maybe_relative_url: str) -> str | None:
    absolute_url = urljoin(base_url, maybe_relative_url)
    parsed = urlparse(absolute_url)

    if parsed.scheme not in {"http", "https"}:
        return None
    if parsed.netloc != SITE_HOST:
        return None
    if parsed.fragment:
        parsed = parsed._replace(fragment="")

    path = unquote(parsed.path)
    if path.startswith("/images/") or path.startswith("/skins/"):
        return None

    query = parse_qs(parsed.query)
    if "action" in query or "oldid" in query or "diff" in query:
        return None

    title = None
    if path == "/index.php":
        title = query.get("title", [None])[0]
    elif path.startswith("/"):
        title = path.lstrip("/")

    if not title:
        return None

    title = unquote(title)
    if any(title.startswith(prefix) for prefix in EXCLUDED_PREFIXES):
        return None

    normalized_path = f"/{title}" if path != "/index.php" else "/index.php"
    normalized_query = f"title={title}" if path == "/index.php" else ""
    return urlunparse(parsed._replace(path=normalized_path, query=normalized_query))


def crawl_pages(start_url: str, max_pages: int | None) -> tuple[list[str], list[str]]:
    pending = deque([start_url])
    visited: set[str] = set()
    ordered_pages: list[str] = []
    image_urls: list[str] = []

    while pending:
        current_url = pending.popleft()
        if current_url in visited:
            continue

        visited.add(current_url)
        ordered_pages.append(current_url)

        html = fetch_text(current_url)
        parser = WikiContentParser()
        parser.feed(html)

        for image_url in parser.png_urls:
            normalized_image_url = normalize_image_url(current_url, image_url)
            if normalized_image_url:
                image_urls.append(normalized_image_url)

        for linked_url in parser.page_urls:
            normalized_page_url = normalize_page_url(current_url, linked_url)
            if normalized_page_url and normalized_page_url not in visited:
                pending.append(normalized_page_url)

        if max_pages is not None and len(ordered_pages) >= max_pages:
            break

    return ordered_pages, unique_preserve_order(image_urls)


def download_pngs(
    page_url: str,
    output_dir: Path,
    recursive: bool,
    site_wide: bool,
    max_pages: int | None,
) -> tuple[int, int]:
    if site_wide:
        pages, image_urls = crawl_pages(DEFAULT_PAGE_URL, max_pages=max_pages)
    elif recursive:
        pages, image_urls = crawl_pages(page_url, max_pages=max_pages)
    else:
        html = fetch_text(page_url)
        parser = WikiContentParser()
        parser.feed(html)
        pages = [page_url]
        image_urls = unique_preserve_order(
            image_url
            for raw_url in parser.png_urls
            if (image_url := normalize_image_url(page_url, raw_url)) is not None
        )

    output_dir.mkdir(parents=True, exist_ok=True)

    for image_url in image_urls:
        filename = build_filename(image_url)
        destination = output_dir / filename
        destination.write_bytes(fetch_bytes(image_url))
        print(f"saved {destination.as_posix()} <- {image_url}")

    return len(pages), len(image_urls)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download PNG images referenced by the Blood on the Clocktower wiki."
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
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Follow linked wiki pages recursively from --page-url.",
    )
    parser.add_argument(
        "--site-wide",
        action="store_true",
        help="Crawl the entire wiki site starting from Main_Page.",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Maximum number of pages to crawl for recursive modes.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        page_count, image_count = download_pngs(
            page_url=args.page_url,
            output_dir=Path(args.output_dir),
            recursive=args.recursive,
            site_wide=args.site_wide,
            max_pages=args.max_pages,
        )
    except Exception as exc:  # pragma: no cover
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"crawled {page_count} page(s)")
    print(f"downloaded {image_count} png file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
