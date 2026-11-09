"""Rebuild owned silent examples with the current renderer; never model inference.

Manifest/appearance data are parsed and preserved, not inferred from the script.
This does not touch published RAR/PDF/video artifacts or contact any service.
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from nova_voice.whiteboard import WhiteboardPage, whiteboard_html  # noqa: E402

EXAMPLES = (
    "greetings-whiteboard.html",
    "greetings-kids.html",
    "visual-scenes.html",
    "water-cycle-whiteboard.html",
    "complete-lesson-demo.html",
    "animated-lesson-demo.html",
    "advanced-motion-demo.html",
    "composition-demo.html",
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Reject a stale example")
    args = parser.parse_args()
    for name in EXAMPLES:
        path = ROOT / "examples" / name
        page = WhiteboardPage.load(path)
        content = whiteboard_html(page.lesson, appearance=page.appearance)
        if args.check:
            if content != path.read_text(encoding="utf-8-sig"):
                parser.exit(1, f"Stale owned example: {name}\n")
        else:
            path.write_text(content, encoding="utf-8-sig")
        print(("Checked " if args.check else "Rebuilt ") + name)


if __name__ == "__main__":
    main()
