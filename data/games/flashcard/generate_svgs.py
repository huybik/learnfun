"""Generate decorative SVG assets for flashcard game using Gemini Flash.

Usage:
    python generate_svgs.py                    # generate missing only
    python generate_svgs.py --force            # regenerate all
    python generate_svgs.py trophy star-filled # regenerate specific
"""

import asyncio
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai

ROOT = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(ROOT / ".env")

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY not found in environment or .env")
    sys.exit(1)

ASSETS_DIR = Path(__file__).parent / "src" / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

FORCE = "--force" in sys.argv
TARGETS = [a for a in sys.argv[1:] if not a.startswith("--")]

# name → (viewBox size, prompt)
ASSETS: dict[str, tuple[int, str]] = {
    "card-back": (128, (
        "Generate an SVG decorative card back pattern. Purple (#6C63FF) rounded"
        " rectangle background with a subtle repeating pattern of question marks"
        " and stars in slightly lighter purple. Centered, playful, kid-friendly."
        " Viewbox 0 0 128 128. No external references. Use inline styles only,"
        " no CSS classes. Prefix all gradient/filter/pattern IDs with 'card-back_'."
        " Output ONLY raw SVG markup, no markdown fences."
    )),
    "trophy": (128, (
        "Generate an SVG golden trophy cup. Celebratory, kid-friendly design with"
        " a shiny gold cup on a small base. Simple but appealing with subtle"
        " highlights. Viewbox 0 0 128 128. Centered, filling ~80% of viewbox."
        " No text, no background, no external references. Use inline styles only,"
        " no CSS classes. Prefix all gradient/filter IDs with 'trophy_'."
        " Output ONLY raw SVG markup, no markdown fences."
    )),
    "star-filled": (64, (
        "Generate an SVG filled 5-pointed star in gold (#FFD700) with a subtle"
        " gradient for depth. Clean, bold, symmetric. Kid-friendly."
        " Viewbox 0 0 64 64. Centered, filling ~80% of viewbox."
        " No text, no background, no external references. Use inline styles only,"
        " no CSS classes. Prefix all gradient/filter IDs with 'star-filled_'."
        " Output ONLY raw SVG markup, no markdown fences."
    )),
    "star-empty": (64, (
        "Generate an SVG outline-only 5-pointed star. Same proportions as a filled"
        " star but just a 3px stroke in gold (#FFD700), no fill. Clean, bold."
        " Viewbox 0 0 64 64. Centered, filling ~80% of viewbox."
        " No text, no background, no external references. Use inline styles only,"
        " no CSS classes. Prefix all gradient/filter IDs with 'star-empty_'."
        " Output ONLY raw SVG markup, no markdown fences."
    )),
    "lightning": (64, (
        "Generate an SVG yellow (#FFD700) lightning bolt. Energetic, bold, angular"
        " design. Kid-friendly with a slight orange gradient for depth."
        " Viewbox 0 0 64 64. Centered, filling ~80% of viewbox."
        " No text, no background, no external references. Use inline styles only,"
        " no CSS classes. Prefix all gradient/filter IDs with 'lightning_'."
        " Output ONLY raw SVG markup, no markdown fences."
    )),
    "checkmark": (64, (
        "Generate an SVG bold green (#4CAF50) checkmark/tick mark. Rounded stroke"
        " ends, thick lines, confident design. Kid-friendly."
        " Viewbox 0 0 64 64. Centered, filling ~80% of viewbox."
        " No text, no background, no external references. Use inline styles only,"
        " no CSS classes. Prefix all gradient/filter IDs with 'checkmark_'."
        " Output ONLY raw SVG markup, no markdown fences."
    )),
    "cross": (64, (
        "Generate an SVG bold red (#F44336) X mark. Rounded stroke ends, thick"
        " lines, clear rejection symbol. Kid-friendly, not scary."
        " Viewbox 0 0 64 64. Centered, filling ~80% of viewbox."
        " No text, no background, no external references. Use inline styles only,"
        " no CSS classes. Prefix all gradient/filter IDs with 'cross_'."
        " Output ONLY raw SVG markup, no markdown fences."
    )),
    "sparkle": (64, (
        "Generate an SVG decorative sparkle/shine effect. Gold/yellow (#FFD700)"
        " four-pointed sparkle star with smaller sparkles around it. Magical,"
        " celebratory feel. Viewbox 0 0 64 64. Centered, filling ~80% of viewbox."
        " No text, no background, no external references. Use inline styles only,"
        " no CSS classes. Prefix all gradient/filter IDs with 'sparkle_'."
        " Output ONLY raw SVG markup, no markdown fences."
    )),
}

client = genai.Client(api_key=API_KEY)


def normalize_svg(text: str, name: str, size: int = 128) -> str:
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
    svg = re.sub(r"(<svg)\s[^>]*?(>)", _fix_svg_attrs(size), svg, count=1)
    return svg


def _fix_svg_attrs(size: int):
    """Return replacer that sets fixed width/height/viewBox for given size."""
    def replacer(m: re.Match) -> str:
        return (
            f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}"'
            f' xmlns="http://www.w3.org/2000/svg">'
        )
    return replacer


async def generate_one(
    name: str, size: int, prompt: str
) -> tuple[str, str | None, str | None]:
    """Generate SVG for one asset. Returns (name, svg, error)."""
    out_path = ASSETS_DIR / f"{name}.svg"
    if out_path.exists() and not FORCE and not TARGETS:
        return name, None, "skipped"
    try:
        response = await client.aio.models.generate_content(
            model="gemini-flash-latest",
            contents=prompt,
        )
        svg = normalize_svg(response.text, name, size)
        out_path.write_text(svg)
        return name, svg, None
    except Exception as e:
        return name, None, str(e)


async def main():
    all_names = list(ASSETS.keys())
    if TARGETS:
        bad = [t for t in TARGETS if t not in ASSETS]
        if bad:
            print(f"ERROR: unknown names: {', '.join(bad)}")
            print(f"  Valid: {', '.join(sorted(all_names))}")
            sys.exit(1)

    names = TARGETS if TARGETS else all_names
    tasks = [generate_one(n, *ASSETS[n]) for n in names]

    print(f"Generating {len(tasks)} SVG assets...")
    if TARGETS:
        print(f"  targets: {', '.join(TARGETS)}")
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
