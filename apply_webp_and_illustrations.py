"""
1단계: 모든 MD/JS/HTML/CSS 에서 .png -> .webp 참조 변경
2단계: 생성된 삽화를 각 MD 파일에 삽입
"""

import json, os, re, sys
from pathlib import Path

ROOT = os.path.dirname(__file__)
SRC = os.path.join(ROOT, "src")
RULES_DIR = os.path.join(SRC, "rules")
PROMPTS_PATH = os.path.join(SRC, "asset", "image_prompts.json")


# ─── 1단계: .png -> .webp 치환 ───

def replace_png_refs():
    """src/ 하위 모든 텍스트 파일에서 .png -> .webp 변경"""
    exts = {".md", ".js", ".html", ".css", ".json"}
    count = 0
    files_changed = 0

    for root, dirs, files in os.walk(SRC):
        # node_modules 등 제외
        dirs[:] = [d for d in dirs if d not in {"node_modules", ".git"}]
        for fname in files:
            fpath = os.path.join(root, fname)
            if Path(fname).suffix.lower() not in exts:
                continue
            # image_prompts.json은 건너뜀 (prompt 텍스트에 .png가 없음)
            if fname == "image_prompts.json":
                continue

            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
            except (UnicodeDecodeError, PermissionError):
                continue

            # .png -> .webp (이미지 참조만)
            new_content = content.replace(".png", ".webp")

            if new_content != content:
                replacements = content.count(".png") - new_content.count(".png")
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                rel = os.path.relpath(fpath, ROOT)
                count += content.count(".png")
                files_changed += 1

    print(f"[Step 1] .png -> .webp: {count} replacements in {files_changed} files")
    return count


# ─── 2단계: 삽화 삽입 ───

def load_prompts():
    with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def insert_illustrations():
    """image_prompts.json 기반으로 MD 파일에 삽화 삽입"""
    data = load_prompts()
    images = data["images"]

    # file별로 그룹핑 (tab은 제외)
    by_file = {}
    for img in images:
        f = img["file"]
        if f == "tab":
            continue
        if f not in by_file:
            by_file[f] = {"page_header": None, "sections": []}
        if img["type"] == "page_header":
            by_file[f]["page_header"] = img
        elif img["type"] == "section_banner":
            by_file[f]["sections"].append(img)

    total_inserted = 0

    for md_file, img_data in sorted(by_file.items()):
        fpath = os.path.join(RULES_DIR, md_file)
        if not os.path.exists(fpath):
            print(f"  [SKIP] {md_file} not found")
            continue

        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

        lines = content.split("\n")
        new_lines = []
        h2_index = 0
        sections = img_data["sections"]
        page_header = img_data["page_header"]
        inserted_header = False
        inserted_count = 0

        for i, line in enumerate(lines):
            new_lines.append(line)

            # H1 뒤에 page_header 삽입
            if not inserted_header and line.startswith("# ") and page_header:
                img_id = page_header["id"]
                ratio = page_header["ratio"]
                subfolder = "1x1" if ratio == "1:1" else "2x1"
                img_path = f"../asset/generated/{subfolder}/{img_id}.webp"
                new_lines.append("")
                new_lines.append(f"![](  {img_path})")
                inserted_header = True
                inserted_count += 1

            # H2 뒤에 section_banner 삽입
            elif line.startswith("## ") and h2_index < len(sections):
                sec = sections[h2_index]
                img_id = sec["id"]
                ratio = sec["ratio"]
                subfolder = "1x1" if ratio == "1:1" else "2x1"
                img_path = f"../asset/generated/{subfolder}/{img_id}.webp"
                new_lines.append("")
                new_lines.append(f"![](  {img_path})")
                h2_index += 1
                inserted_count += 1

        if inserted_count > 0:
            with open(fpath, "w", encoding="utf-8") as f:
                f.write("\n".join(new_lines))
            total_inserted += inserted_count

        print(f"  {md_file}: +{inserted_count} images (header={'Y' if inserted_header else 'N'}, sections={h2_index}/{len(sections)})")

    print(f"\n[Step 2] Illustrations inserted: {total_inserted} images into {len(by_file)} files")
    return total_inserted


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    print("=== Apply WebP + Illustrations ===\n")

    # Step 1
    replace_png_refs()
    print()

    # Step 2
    insert_illustrations()

    print("\n=== Done! ===")


if __name__ == "__main__":
    main()
