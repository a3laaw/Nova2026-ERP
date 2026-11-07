"""Explicit ONE-TIME online setup, never imported by the desktop application.

Run on a connected machine, then copy the resulting folder to the offline PC.
Downloads only official Piper files; all model/config transfers are size/hash checked.
"""

import argparse
import hashlib
import json
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nova_voice.voices import VoiceSpec  # noqa: E402

BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
VOICE_PATHS = {
    "ar_JO-kareem-medium": "ar/ar_JO/kareem/medium/",
    "en_US-lessac-medium": "en/en_US/lessac/medium/",
    "en_US-amy-medium": "en/en_US/amy/medium/",
}


def read_index() -> dict:
    with urlopen(BASE_URL + "voices.json?download=true", timeout=60) as response:
        content = response.read(20 * 1024 * 1024 + 1)
    if len(content) > 20 * 1024 * 1024:
        raise ValueError("The voice index is unexpectedly large.")
    return json.loads(content)


def download_file(url: str, target: Path, metadata: dict | None = None) -> None:
    metadata = metadata or {}
    expected_size = metadata.get("size_bytes")
    expected_md5 = metadata.get("md5_digest")
    maximum = int(expected_size) if expected_size else 1024 * 1024
    if not 0 < maximum <= 1024 * 1024 * 1024:
        raise ValueError("Invalid file size in the official voice index.")
    checksum = hashlib.md5(usedforsecurity=False)  # Upstream's integrity field, not authentication.
    written = 0
    with urlopen(url, timeout=60) as response, target.open("wb") as output:
        while block := response.read(1024 * 1024):
            written += len(block)
            if written > maximum:
                raise ValueError(f"Unexpected file size: {target.name}")
            checksum.update(block)
            output.write(block)
        content_length = response.headers.get("Content-Length")
    if not written or (expected_size and written != int(expected_size)):
        raise ValueError(f"Incomplete download: {target.name}")
    if content_length and written != int(content_length):
        raise ValueError(f"Truncated download: {target.name}")
    if expected_md5 and checksum.hexdigest().lower() != expected_md5.lower():
        raise ValueError(f"Checksum mismatch: {target.name}")


def download_voice(voice: str, output_dir: Path) -> Path:
    if voice not in VOICE_PATHS:
        raise ValueError("Unsupported setup voice. Import other Piper voices through the app.")
    output_dir.mkdir(parents=True, exist_ok=True)
    destination = output_dir / voice
    if destination.exists():
        VoiceSpec.from_path(destination / f"{voice}.onnx")
        print(f"Voice already installed: {destination}")
        return destination
    index = read_index()
    entry = index[voice]
    remote_dir = VOICE_PATHS[voice]
    with tempfile.TemporaryDirectory(prefix=".download-", dir=output_dir) as temporary:
        staging = Path(temporary) / voice
        staging.mkdir()
        for suffix in (".onnx", ".onnx.json"):
            filename = f"{voice}{suffix}"
            remote_path = remote_dir + filename
            metadata = entry["files"][remote_path]
            if not metadata.get("size_bytes") or not metadata.get("md5_digest"):
                raise ValueError("Official index is missing file integrity information.")
            print(
                f"Downloading {filename} ({int(metadata['size_bytes']) / 1024 / 1024:.1f} MiB)..."
            )
            download_file(BASE_URL + remote_path + "?download=true", staging / filename, metadata)
        print("Downloading voice license/model card...")
        download_file(BASE_URL + remote_dir + "MODEL_CARD?download=true", staging / "MODEL_CARD")
        VoiceSpec.from_path(staging / f"{voice}.onnx")
        staging.replace(destination)
    print(f"Ready for offline use: {destination}")
    print("Read MODEL_CARD before using or redistributing this voice.")
    return destination


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("voice", choices=VOICE_PATHS, nargs="?", default="ar_JO-kareem-medium")
    parser.add_argument(
        "--output", type=Path, default=Path(__file__).resolve().parents[1] / "voices"
    )
    args = parser.parse_args(argv)
    try:
        download_voice(args.voice, args.output)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Voice setup failed: {error}", file=sys.stderr)
        print("No incomplete voice was installed. Retry online or import the two files manually.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
