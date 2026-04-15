"""
전체 이미지 생성: GQ2_minimal 스타일 × 204장 (image_prompts.json 기반)
"""

import json, copy, random, time, requests, os, urllib.parse, sys

COMFYUI_URL = "http://100.66.10.225:8188"
WORKFLOW_PATH = os.path.join(os.path.dirname(__file__), "src", "asset", "image_qwen_image_2512_with_2steps_lora.json")
PROMPTS_PATH = os.path.join(os.path.dirname(__file__), "src", "asset", "image_prompts.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "src", "asset", "generated")

STYLE_PREFIX = "Gothic paper quilling art style, clean sculpted paper coils on dark matte background, monochrome palette with selective crimson and gold highlights, minimalist composition with strong negative space, baroque ornamental borders, sharp shadows creating depth, masterwork paper art, "


def load_workflow():
    with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_prompts():
    with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def build_prompt(base_wf, prompt_text, filename_prefix, width, height):
    wf = copy.deepcopy(base_wf)
    wf["108"]["inputs"]["text"] = prompt_text
    wf["107"]["inputs"]["width"] = width
    wf["107"]["inputs"]["height"] = height
    wf["107"]["inputs"]["batch_size"] = 1
    wf["106"]["inputs"]["seed"] = random.randint(1, 2**53)
    wf["123"]["inputs"]["filename_prefix"] = f"Final/{filename_prefix}"
    return {"prompt": wf}


def queue_prompt(prompt_data):
    resp = requests.post(f"{COMFYUI_URL}/prompt", json=prompt_data)
    resp.raise_for_status()
    return resp.json().get("prompt_id")


def get_history(prompt_id):
    resp = requests.get(f"{COMFYUI_URL}/history/{prompt_id}")
    resp.raise_for_status()
    return resp.json()


def download_image(filename, subfolder, output_type="output"):
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": output_type})
    resp = requests.get(f"{COMFYUI_URL}/view?{params}")
    resp.raise_for_status()
    return resp.content


def wait_for_completion(prompt_id, timeout=300, poll_interval=3):
    start = time.time()
    while time.time() - start < timeout:
        history = get_history(prompt_id)
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(poll_interval)
    raise TimeoutError(f"Timeout: {prompt_id}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")

    # output subdirs
    for sub in ["1x1", "2x1"]:
        os.makedirs(os.path.join(OUTPUT_DIR, sub), exist_ok=True)

    base_wf = load_workflow()
    data = load_prompts()
    images = data["images"]
    total = len(images)

    print(f"=== Full Generation: {total} images ===")
    print(f"Style: GQ2_minimal")
    print(f"Output: {OUTPUT_DIR}")
    print()

    # Track progress for resume capability
    progress_file = os.path.join(OUTPUT_DIR, "progress.json")
    completed = set()
    if os.path.exists(progress_file):
        with open(progress_file, "r") as f:
            completed = set(json.load(f))
        print(f"Resuming: {len(completed)} already done, {total - len(completed)} remaining\n")

    ok_count = len(completed)
    fail_count = 0

    for idx, img in enumerate(images):
        img_id = img["id"]

        # Skip already completed
        if img_id in completed:
            continue

        # Determine dimensions based on ratio
        ratio = img["ratio"]
        if ratio == "1:1":
            width, height = 1024, 1024
            subfolder = "1x1"
        else:  # 2:1
            width, height = 1024, 512
            subfolder = "2x1"

        full_prompt = STYLE_PREFIX + img["prompt"]
        print(f"[{idx+1}/{total}] {img_id} ({ratio})")

        prompt_data = build_prompt(base_wf, full_prompt, f"{subfolder}/{img_id}", width, height)

        try:
            prompt_id = queue_prompt(prompt_data)
            result = wait_for_completion(prompt_id, timeout=300)
            status = result.get("status", {})

            if status.get("status_str") == "error":
                msgs = status.get("messages", [])
                for msg in msgs:
                    if msg[0] == "execution_error":
                        print(f"  [ERROR] {msg[1].get('exception_message', '?')}")
                fail_count += 1
                continue

            outputs = result.get("outputs", {})
            for node_id, node_output in outputs.items():
                if "images" in node_output:
                    for img_info in node_output["images"]:
                        img_data = download_image(
                            img_info["filename"],
                            img_info.get("subfolder", ""),
                            img_info.get("type", "output"),
                        )
                        local_path = os.path.join(OUTPUT_DIR, subfolder, f"{img_id}.png")
                        with open(local_path, "wb") as f:
                            f.write(img_data)
                        print(f"  [OK] {subfolder}/{img_id}.png ({len(img_data)//1024}KB)")
                        ok_count += 1
                        completed.add(img_id)

            # Save progress after each success
            with open(progress_file, "w") as f:
                json.dump(list(completed), f)

        except Exception as e:
            print(f"  [ERROR] {e}")
            fail_count += 1

    # Final summary
    print()
    print("=" * 60)
    print(f"=== COMPLETE ===")
    print(f"  OK:   {ok_count}/{total}")
    print(f"  FAIL: {fail_count}")
    print(f"  Output: {OUTPUT_DIR}")

    # Count by type
    by_ratio = {}
    for img in images:
        r = img["ratio"]
        by_ratio[r] = by_ratio.get(r, 0) + 1
    for r, c in sorted(by_ratio.items()):
        print(f"  {r}: {c} images")


if __name__ == "__main__":
    main()
