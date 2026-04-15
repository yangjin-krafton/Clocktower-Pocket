"""
랜딩 화면 배경 이미지 10장 생성 (1024x1024, GQ2_minimal 스타일)
"""
import json, copy, random, time, requests, os, urllib.parse, sys

COMFYUI_URL = "http://100.66.10.225:8188"
WORKFLOW_PATH = os.path.join(os.path.dirname(__file__), "src", "asset", "image_qwen_image_2512_with_2steps_lora.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "src", "asset", "generated", "landing")

STYLE = "Gothic paper quilling art style, clean sculpted paper coils on dark matte background, monochrome palette with selective crimson and gold highlights, minimalist composition with strong negative space, baroque ornamental borders, sharp shadows creating depth, masterwork paper art, "

PROMPTS = [
    "A grand ancient clocktower rising from a small gothic village at midnight, full moon behind the tower, bats circling the spire, cobblestone streets below with faint warm window lights",

    "An ornate circular arrangement of mysterious role tokens on dark velvet, each token bearing a unique carved symbol glowing faintly, a demonic eye in the center watching",

    "A secret midnight gathering of cloaked villagers around a bonfire in a village square, the clocktower silhouette towering above, long shadows stretching across cobblestones",

    "An ancient grimoire book open on an altar, revealing illustrated pages of good and evil characters, candles dripping wax on both sides, mystical energy swirling from the pages",

    "A dramatic split scene of day and night in a gothic village, left side bright with debating villagers, right side dark with lurking shadows and a demon on the clocktower",

    "A massive ornate clock face viewed from below, its hands pointing to midnight, gargoyles and ravens perched on the roman numerals, storm clouds swirling behind",

    "A village gallows platform under torchlight, an executioner's shadow cast long across the stone square, the clocktower bell visible above, a crowd of faceless observers",

    "A fortune teller's table with a glowing crystal ball at center, scattered tarot cards showing skulls and angels, poison vials and a monk's rosary arranged around the edges",

    "A demon imp perched atop a gothic spire overlooking a sleeping village, bat wings folded, one clawed hand reaching down toward the houses below, crimson eyes piercing the fog",

    "An ancient stone doorway framing a view into a candlelit village council chamber, hooded figures debating around a round table, accusatory fingers pointed, secrets and lies in the air",
]


def load_workflow():
    with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def build_prompt(base_wf, prompt_text, filename_prefix):
    wf = copy.deepcopy(base_wf)
    wf["108"]["inputs"]["text"] = prompt_text
    wf["107"]["inputs"]["width"] = 1024
    wf["107"]["inputs"]["height"] = 1024
    wf["107"]["inputs"]["batch_size"] = 1
    wf["106"]["inputs"]["seed"] = random.randint(1, 2**53)
    wf["123"]["inputs"]["filename_prefix"] = f"Landing/{filename_prefix}"
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
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    base_wf = load_workflow()

    print(f"=== Landing Background: 10 images ===\n")

    for i, prompt in enumerate(PROMPTS):
        name = f"landing_{i:02d}"
        full_prompt = STYLE + prompt
        print(f"[{i+1}/10] {name}")

        prompt_data = build_prompt(base_wf, full_prompt, name)
        prompt_id = queue_prompt(prompt_data)

        try:
            result = wait_for_completion(prompt_id)
            outputs = result.get("outputs", {})
            for node_output in outputs.values():
                if "images" in node_output:
                    for img_info in node_output["images"]:
                        img_data = download_image(
                            img_info["filename"],
                            img_info.get("subfolder", ""),
                            img_info.get("type", "output"),
                        )
                        local_path = os.path.join(OUTPUT_DIR, f"{name}.png")
                        with open(local_path, "wb") as f:
                            f.write(img_data)
                        print(f"  [OK] {len(img_data)//1024}KB")
        except Exception as e:
            print(f"  [ERROR] {e}")

    # WebP 변환
    print("\nConverting to WebP...")
    from PIL import Image
    from pathlib import Path
    for png in sorted(Path(OUTPUT_DIR).glob("*.png")):
        with Image.open(png) as img:
            if img.mode in ("RGBA", "LA", "PA"):
                img.save(png.with_suffix(".webp"), "WEBP", quality=85, method=6)
            else:
                img.convert("RGB").save(png.with_suffix(".webp"), "WEBP", quality=85, method=6)
        src_kb = png.stat().st_size // 1024
        dst_kb = png.with_suffix(".webp").stat().st_size // 1024
        png.unlink()
        print(f"  {png.name} -> .webp ({src_kb}KB -> {dst_kb}KB)")

    print("\nDone!")

if __name__ == "__main__":
    main()
