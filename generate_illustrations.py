"""
Blood on the Clocktower 삽화 생성 스크립트
ComfyUI API를 통해 Qwen Image 2512 + 2steps LoRA 모델로 다양한 스타일의 삽화를 생성합니다.
"""

import json
import copy
import random
import time
import requests
import os
import urllib.parse

COMFYUI_URL = "http://100.66.10.225:8188"
WORKFLOW_PATH = os.path.join(os.path.dirname(__file__), "src", "asset", "image_qwen_image_2512_with_2steps_lora.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "src", "asset", "illustrations")

# 10가지 다양한 스타일의 Blood on the Clocktower 삽화 프롬프트
PROMPTS = [
    {
        "name": "01_imp_dark_fantasy",
        "prompt": "Dark fantasy illustration of a sinister imp demon perched atop an ancient clocktower at midnight, glowing crimson eyes piercing through swirling fog, tattered bat-like wings spread wide, gothic Victorian village below shrouded in darkness, dramatic moonlight casting long shadows, intricate pen and ink style with deep reds and blacks, dark fairy tale aesthetic, highly detailed",
    },
    {
        "name": "02_monk_medieval",
        "prompt": "Medieval illuminated manuscript style illustration of a protective monk standing guard before a sleeping village, golden halo radiating soft divine light, brown robes billowing in night wind, one hand raised in blessing forming a translucent shield of holy energy, candlelit monastery corridor background with arched stone windows, rich gold leaf accents on deep blue and burgundy, Book of Kells inspired ornamental borders, devotional art style",
    },
    {
        "name": "03_fortuneteller_mystical",
        "prompt": "Mystical art nouveau illustration of a fortune teller gazing into a luminous crystal ball, ethereal purple and teal energy swirling within revealing shadowy faces, ornate tarot cards scattered on a velvet cloth, elaborate Mucha-inspired floral frame border, mysterious candlelit tent interior with hanging crystals and star charts, rich jewel tones of amethyst purple and midnight blue, decorative occult symbolism, mystical divination aesthetic",
    },
    {
        "name": "04_poisoner_gothic",
        "prompt": "Gothic horror illustration of a hooded poisoner in a dark alchemist laboratory, mixing luminous green bubbling potions in ornate glass vials, shelves lined with skull-labeled bottles and dried herbs, sickly green light casting ominous shadows on stone walls, wisps of toxic vapor rising from a bubbling cauldron, Tim Burton inspired style with exaggerated proportions, dark whimsical atmosphere, muted palette with acid green accents",
    },
    {
        "name": "05_scarlet_woman_noir",
        "prompt": "Film noir style dramatic illustration of an elegant woman in a flowing scarlet dress standing in rain-soaked cobblestone street under a single gas lamp, long shadows stretching behind her, mysterious smile hiding dark secrets, fog rolling between Victorian buildings, high contrast black and white with selective vivid red color on her dress and lips only, cinematic composition, femme fatale aesthetic, moody atmospheric lighting",
    },
    {
        "name": "06_village_clocktower",
        "prompt": "Atmospheric landscape painting of a small cursed Victorian village at twilight, a massive ancient clocktower dominating the skyline with its clock face glowing ominously, quaint cottages with warm candlelit windows lining winding cobblestone streets, bare twisted trees silhouetted against a dramatic orange and purple sunset sky, flocks of ravens circling the tower, painterly impressionistic brushstrokes, haunting autumn atmosphere, Caspar David Friedrich inspired romantic gothic landscape",
    },
    {
        "name": "07_slayer_heroic",
        "prompt": "Heroic fantasy illustration of a determined demon slayer warrior standing defiantly on a cliff edge, wielding an ornate silver crossbow aimed at unseen darkness below, windswept cloak and hair, battle-worn leather armor with holy symbols, dramatic stormy sky with lightning illuminating the scene, dynamic action pose, bold linework with vibrant warm and cool contrast, comic book inspired heroic composition, epic fantasy adventure aesthetic",
    },
    {
        "name": "08_spy_watercolor",
        "prompt": "Loose expressive watercolor illustration of a mysterious spy figure peering through a rain-streaked window at a secret village council meeting inside a candlelit tavern, faces reflected in puddles on the ground, wet-on-wet watercolor technique with intentional ink bleeds and splashes, limited palette of indigo blue and sepia brown with touches of warm amber candlelight, atmospheric negative space, spy thriller tension, artistic editorial illustration style",
    },
    {
        "name": "09_execution_woodcut",
        "prompt": "Dark medieval woodcut print style illustration of a village execution scene in a town square, hooded executioner and gathered crowd of villagers with torches surrounding a wooden gallows, a massive clocktower looming in the background, stark black and white high contrast with crosshatching textures, Albrecht Durer inspired Northern Renaissance printmaking aesthetic, dramatic composition with strong diagonal lines, historical horror atmosphere",
    },
    {
        "name": "10_night_council_storybook",
        "prompt": "Whimsical dark storybook illustration of a secret nighttime village council, diverse villagers gathered around a large round table in a cozy candlelit room, each character with exaggerated expressive features showing suspicion and intrigue, some whispering conspiratorially while others point accusingly, warm golden interior light contrasting with dark blue night visible through windows, children book illustration style with rich textures, Maurice Sendak meets Edward Gorey aesthetic",
    },
]


def load_workflow():
    with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def build_prompt(base_workflow, prompt_text, filename_prefix, seed=None):
    """워크플로를 수정하여 ComfyUI API용 prompt 객체를 생성"""
    wf = copy.deepcopy(base_workflow)

    # 프롬프트 텍스트 변경 (노드 108)
    wf["108"]["inputs"]["text"] = prompt_text

    # 이미지 크기 1024x1024, batch_size=2 (노드 107)
    wf["107"]["inputs"]["width"] = 1024
    wf["107"]["inputs"]["height"] = 1024
    wf["107"]["inputs"]["batch_size"] = 2

    # 시드 랜덤화 (노드 106)
    if seed is None:
        seed = random.randint(1, 2**53)
    wf["106"]["inputs"]["seed"] = seed

    # 파일명 접두사 변경 (노드 123)
    wf["123"]["inputs"]["filename_prefix"] = f"BotC/{filename_prefix}"

    return {"prompt": wf}


def queue_prompt(prompt_data):
    """ComfyUI에 prompt를 큐에 추가"""
    resp = requests.post(f"{COMFYUI_URL}/prompt", json=prompt_data)
    resp.raise_for_status()
    result = resp.json()
    return result.get("prompt_id")


def get_history(prompt_id):
    """prompt_id에 대한 생성 결과 조회"""
    resp = requests.get(f"{COMFYUI_URL}/history/{prompt_id}")
    resp.raise_for_status()
    return resp.json()


def download_image(filename, subfolder, output_type="output"):
    """생성된 이미지를 다운로드"""
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": output_type})
    resp = requests.get(f"{COMFYUI_URL}/view?{params}")
    resp.raise_for_status()
    return resp.content


def wait_for_completion(prompt_id, timeout=300, poll_interval=3):
    """prompt 완료까지 대기"""
    start = time.time()
    while time.time() - start < timeout:
        history = get_history(prompt_id)
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(poll_interval)
    raise TimeoutError(f"Prompt {prompt_id} did not complete within {timeout}s")


def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    base_workflow = load_workflow()
    print(f"=== Blood on the Clocktower illustration generation ===")
    print(f"Total: {len(PROMPTS)} prompts x 2 images = {len(PROMPTS) * 2} images")
    print(f"Resolution: 1024x1024")
    print(f"Output: {OUTPUT_DIR}")
    print()

    results = []

    for i, p in enumerate(PROMPTS):
        print(f"[{i+1}/{len(PROMPTS)}] {p['name']} generating...")
        print(f"  Prompt: {p['prompt'][:80]}...")

        prompt_data = build_prompt(base_workflow, p["prompt"], p["name"])
        prompt_id = queue_prompt(prompt_data)
        print(f"  Queue ID: {prompt_id}")

        # 완료 대기
        try:
            result = wait_for_completion(prompt_id, timeout=300)
            status = result.get("status", {})
            if status.get("status_str") == "error":
                print(f"  [ERROR]")
                msgs = status.get("messages", [])
                for msg in msgs:
                    if msg[0] == "execution_error":
                        print(f"     {msg[1].get('exception_message', 'unknown error')}")
                results.append({"name": p["name"], "status": "error", "images": []})
                continue

            # 이미지 다운로드
            outputs = result.get("outputs", {})
            images_saved = []
            for node_id, node_output in outputs.items():
                if "images" in node_output:
                    for img_info in node_output["images"]:
                        img_data = download_image(
                            img_info["filename"],
                            img_info.get("subfolder", ""),
                            img_info.get("type", "output"),
                        )
                        # 로컬 저장
                        local_name = f"{p['name']}_{img_info['filename']}"
                        local_path = os.path.join(OUTPUT_DIR, local_name)
                        with open(local_path, "wb") as f:
                            f.write(img_data)
                        images_saved.append(local_path)
                        print(f"  [OK] Saved: {local_name} ({len(img_data) // 1024}KB)")

            results.append({"name": p["name"], "status": "success", "images": images_saved})

        except TimeoutError:
            print(f"  [TIMEOUT]")
            results.append({"name": p["name"], "status": "timeout", "images": []})
        except Exception as e:
            print(f"  [ERROR] {e}")
            results.append({"name": p["name"], "status": "error", "images": []})

        print()

    # Summary
    print("=" * 60)
    print("=== Generation Summary ===")
    success = sum(1 for r in results if r["status"] == "success")
    total_images = sum(len(r["images"]) for r in results)
    print(f"Success: {success}/{len(PROMPTS)}")
    print(f"Total images: {total_images}")
    for r in results:
        icon = "[OK]" if r["status"] == "success" else "[FAIL]"
        print(f"  {icon} {r['name']}: {len(r['images'])} images")


if __name__ == "__main__":
    main()
