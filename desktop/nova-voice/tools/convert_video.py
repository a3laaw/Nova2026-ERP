"""Optional offline WebM/MP4 → H.264/AAC MP4. Supply your own trusted FFmpeg."""

import argparse
import sys
from pathlib import Path
from threading import Event

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nova_voice.video import VideoError, convert_video  # noqa: E402
from nova_voice.voices import Cancelled  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Existing local .webm or .mp4")
    parser.add_argument("destination", type=Path, help="New .mp4 filename")
    parser.add_argument(
        "--ffmpeg", required=True, type=Path, help="Trusted local FFmpeg executable"
    )
    parser.add_argument(
        "--reviewed", action="store_true", help="Confirm content/voice/rights review"
    )
    parser.add_argument(
        "--overwrite", action="store_true", help="Explicitly allow atomic replacement"
    )
    args = parser.parse_args(argv)
    try:
        result = convert_video(
            args.source,
            args.destination,
            args.ffmpeg,
            Event(),
            reviewed=args.reviewed,
            overwrite=args.overwrite,
        )
    except (VideoError, OSError, Cancelled) as error:
        print(str(error) or "Conversion cancelled; no partial output published.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Conversion interrupted; no partial output published.", file=sys.stderr)
        return 130
    print(f"Saved: {result.path}\nH.264 Main 3.1 / yuv420p / 1280×720 / 20fps / faststart")
    print(f"Audio: {'AAC-LC' if result.has_audio else 'silent (no audio invented)'}")
    print(f"Duration: {result.duration_seconds:.3f}s; {result.size_bytes:,} bytes")
    print("Codec profile verified and entire output decoded locally; check your target device too.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
