"""Generate SVG fruit assets using Gemini Flash (parallel).

Usage:
    python generate_svgs.py

Reads GEMINI_API_KEY from ../.env (project root).
Outputs SVGs to src/assets/<fruit>.svg
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

FRUITS = [
    "apple", "banana", "orange", "strawberry",
    "grape", "watermelon", "pineapple", "mango",
    "cherry", "lemon", "peach", "pear",
    "kiwi", "coconut", "blueberry", "avocado",
]

PROMPT_TEMPLATE = """Create a single SVG icon of a {fruit}.

Requirements:
- Viewbox: 0 0 128 128
- Style: flat, colorful, cartoon-style suitable for children's educational game
- Use vibrant, appealing colors with simple gradients where appropriate
- Include a small leaf or stem detail where natural for the fruit
- Clean shapes, no tiny details — should look good at 64px and 256px
- No text, no background rectangle, no external references
- The fruit should be centered and fill ~80% of the viewbox
- Use only inline styles, no CSS classes
- Output ONLY the raw SVG markup starting with <svg and ending with </svg>
- No markdown code fences, no explanation, just the SVG
"""

client = genai.Client(api_key=API_KEY)


def normalize_svg(text: str, fruit: str) -> str:
    """Extract SVG markup and enforce consistent width/height/viewBox."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()
    start = text.find("<svg")
    if start == -1:
        raise ValueError(f"No <svg> tag found in response for {fruit}")
    end = text.rfind("</svg>") + len("</svg>")
    svg = text[start:end]
    # Strip any existing width/height/viewBox from the <svg> tag
    svg = re.sub(r'(<svg)\s[^>]*?(>)', _fix_svg_attrs, svg, count=1)
    return svg


def _fix_svg_attrs(m: re.Match) -> str:
    """Replace <svg ...> attributes with fixed width/height/viewBox."""
    return '<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">'


async def generate_one(fruit: str) -> tuple[str, str | None, str | None]:
    """Generate SVG for one fruit. Returns (fruit, svg, error)."""
    out_path = ASSETS_DIR / f"{fruit}.svg"
    if out_path.exists():
        return fruit, None, "skipped"
    try:
        response = await client.aio.models.generate_content(
            model="gemini-flash-latest",
            contents=PROMPT_TEMPLATE.format(fruit=fruit),
        )
        svg = normalize_svg(response.text, fruit)
        out_path.write_text(svg)
        return fruit, svg, None
    except Exception as e:
        return fruit, None, str(e)


async def main():
    print(f"Generating {len(FRUITS)} fruit SVGs in parallel...")
    results = await asyncio.gather(*[generate_one(f) for f in FRUITS])
    for fruit, svg, error in results:
        if error == "skipped":
            print(f"  {fruit} — already exists, skipped")
        elif error:
            print(f"  {fruit} — FAILED: {error}")
        else:
            print(f"  {fruit} — OK ({len(svg)} bytes)")
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
