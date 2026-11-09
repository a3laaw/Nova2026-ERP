"""Rebuild the offline Arabic guide from the native tab's shared catalog/assets."""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from nova_voice.inference import render_guide  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "INFERENCE-GUIDE-AR.html")
    parser.add_argument("--check", action="store_true", help="Reject a stale generated guide")
    args = parser.parse_args()
    content = render_guide()
    if args.check:
        if not args.output.is_file() or args.output.read_text(encoding="utf-8") != content:
            parser.exit(1, "Offline guide is stale; run tools/build_inference_guide.py.\n")
        print("Offline guide matches shared catalog and assets.")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content, encoding="utf-8")
        print(f"Guide: {args.output} ({len(content.encode('utf-8')):,} bytes)")


if __name__ == "__main__":
    main()
