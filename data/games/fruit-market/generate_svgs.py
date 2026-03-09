"""Generate SVG fruit & drink assets using Gemini Flash (parallel).

Usage:
    python generate_svgs.py           # generate missing only
    python generate_svgs.py --force   # regenerate all

Reads GEMINI_API_KEY from ../.env (project root).
Outputs SVGs to src/assets/<name>.svg
"""

import asyncio
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai

# Load .env from project root
ROOT = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(ROOT / ".env")

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY not found in environment or .env")
    sys.exit(1)

ASSETS_DIR = Path(__file__).parent / "src" / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

FORCE = "--force" in sys.argv

FRUITS = [
    "apple", "banana", "orange", "strawberry",
    "grape", "watermelon", "pineapple", "mango",
    "cherry", "lemon", "peach", "pear",
    "kiwi", "coconut", "blueberry", "avocado",
]

DRINKS = [
    "apple-juice",
    "tropical-smoothie",
    "berry-blast",
    "citrus-sunrise",
    "green-machine",
    "watermelon-cooler",
    "coconut-paradise",
    "grape-fizz",
]

FRUIT_PROMPT = """Generate a realistic, detailed SVG of a {fruit} with a cut slice next to it showing the inside. Viewbox 0 0 128 128. Centered, filling ~80% of the viewbox. No text, no background, no external references. Use inline styles only, no CSS classes. Prefix all gradient/filter IDs with "{fruit}_". Output ONLY raw SVG markup, no markdown fences."""

DRINK_PROMPT = """Generate a realistic, detailed SVG of a glass of {drink} juice drink. Make it look delicious and appealing for kids. Viewbox 0 0 128 128. Centered, filling ~80% of the viewbox. No text, no background, no external references. Use inline styles only, no CSS classes. Prefix all gradient/filter IDs with "{name}_". Output ONLY raw SVG markup, no markdown fences."""

client = genai.Client(api_key=API_KEY)


def normalize_svg(text: str, name: str) -> str:
    """Extract SVG markup and enforce consistent width/height/viewBox."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()
    start = text.find("<svg")
    if start == -1:
        raise ValueError(f"No <svg> tag found in response for {name}")
    end = text.rfind("</svg>") + len("</svg>")
    svg = text[start:end]
    svg = re.sub(r'(<svg)\s[^>]*?(>)', _fix_svg_attrs, svg, count=1)
    return svg


def _fix_svg_attrs(m: re.Match) -> str:
    """Replace <svg ...> attributes with fixed width/height/viewBox."""
    return '<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">'


async def generate_one(name: str, prompt: str) -> tuple[str, str | None, str | None]:
    """Generate SVG for one item. Returns (name, svg, error)."""
    out_path = ASSETS_DIR / f"{name}.svg"
    if out_path.exists() and not FORCE:
        return name, None, "skipped"
    try:
        response = await client.aio.models.generate_content(
            model="gemini-flash-latest",
            contents=prompt,
        )
        svg = normalize_svg(response.text, name)
        out_path.write_text(svg)
        return name, svg, None
    except Exception as e:
        return name, None, str(e)


async def main():
    tasks = []
    for fruit in FRUITS:
        prompt = FRUIT_PROMPT.format(fruit=fruit)
        tasks.append(generate_one(fruit, prompt))
    for name in DRINKS:
        drink = name.replace("-", " ")
        prompt = DRINK_PROMPT.format(name=name, drink=drink)
        tasks.append(generate_one(name, prompt))

    total = len(tasks)
    print(f"Generating {total} SVGs ({len(FRUITS)} fruits + {len(DRINKS)} drinks)...")
    if FORCE:
        print("  --force: regenerating all")

    results = await asyncio.gather(*tasks)
    ok = skip = fail = 0
    for name, svg, error in results:
        if error == "skipped":
            print(f"  {name} — already exists, skipped")
            skip += 1
        elif error:
            print(f"  {name} — FAILED: {error}")
            fail += 1
        else:
            print(f"  {name} — OK ({len(svg)} bytes)")
            ok += 1
    print(f"Done! {ok} generated, {skip} skipped, {fail} failed")


if __name__ == "__main__":
    asyncio.run(main())
