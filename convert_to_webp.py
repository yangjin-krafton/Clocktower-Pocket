"""
src/asset 하위 모든 PNG/JPG 이미지를 WebP로 변환
- 원본 파일은 유지하지 않고 WebP로 교체
- 무손실이 아닌 고품질 손실 압축 (quality=85)
- SVG, 폰트 등 비이미지 파일은 건너뜀
"""

import os
import sys
from pathlib import Path
from PIL import Image

ASSET_DIR = os.path.join(os.path.dirname(__file__), "src", "asset")
EXTENSIONS = {".png", ".jpg", ".jpeg"}
WEBP_QUALITY = 85


def convert_image(src_path):
    """이미지를 WebP로 변환하고 원본 삭제"""
    src = Path(src_path)
    dst = src.with_suffix(".webp")

    try:
        with Image.open(src) as img:
            # RGBA 유지 (PNG 투명도 보존)
            if img.mode in ("RGBA", "LA", "PA"):
                img.save(dst, "WEBP", quality=WEBP_QUALITY, method=6)
            else:
                img = img.convert("RGB")
                img.save(dst, "WEBP", quality=WEBP_QUALITY, method=6)

        src_size = src.stat().st_size
        dst_size = dst.stat().st_size
        ratio = (1 - dst_size / src_size) * 100 if src_size > 0 else 0

        # 원본 삭제
        src.unlink()

        return src_size, dst_size, ratio
    except Exception as e:
        print(f"  [SKIP] {src}: {e}")
        return 0, 0, 0


def main():
    sys.stdout.reconfigure(encoding="utf-8")

    # 모든 이미지 파일 수집
    files = []
    for root, dirs, filenames in os.walk(ASSET_DIR):
        # style_test 폴더는 건너뜀 (테스트 파일)
        skip_dirs = {"style_test", "style_test2", "style_test3", "style_test4_quilling", "illustrations"}
        dirs[:] = [d for d in dirs if d not in skip_dirs]

        for fname in filenames:
            if Path(fname).suffix.lower() in EXTENSIONS:
                files.append(os.path.join(root, fname))

    total = len(files)
    print(f"=== WebP Conversion ===")
    print(f"Target: {ASSET_DIR}")
    print(f"Files: {total}")
    print()

    total_src = 0
    total_dst = 0
    converted = 0
    skipped = 0

    for i, fpath in enumerate(sorted(files)):
        rel = os.path.relpath(fpath, ASSET_DIR)
        src_size, dst_size, ratio = convert_image(fpath)

        if src_size > 0:
            converted += 1
            total_src += src_size
            total_dst += dst_size
            if (i + 1) % 20 == 0 or (i + 1) == total:
                print(f"  [{i+1}/{total}] ... {rel} ({src_size//1024}KB -> {dst_size//1024}KB, -{ratio:.0f}%)")
        else:
            skipped += 1

    print()
    print("=" * 60)
    print(f"=== Summary ===")
    print(f"  Converted: {converted}")
    print(f"  Skipped:   {skipped}")
    print(f"  Before:    {total_src / 1024 / 1024:.1f} MB")
    print(f"  After:     {total_dst / 1024 / 1024:.1f} MB")
    print(f"  Saved:     {(total_src - total_dst) / 1024 / 1024:.1f} MB ({(1 - total_dst/total_src)*100:.0f}% reduction)")


if __name__ == "__main__":
    main()
