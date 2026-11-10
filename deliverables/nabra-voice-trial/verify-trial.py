"""Independently verify the delivered PCM, report and self-contained listening page.

No model, Node, network, third-party dependency or integration is needed.
SPDX-License-Identifier: GPL-3.0-or-later
"""

import base64
import hashlib
import json
import math
import re
import struct
import unicodedata
import wave
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.audio = []
        self.active_tags = []
        self.csp = ""

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        if tag == "audio":
            self.audio.append(fields)
        if tag in (
            "script",
            "iframe",
            "object",
            "embed",
            "img",
            "link",
            "source",
            "video",
        ):
            self.active_tags.append(tag)
        if (
            tag == "meta"
            and fields.get("http-equiv", "").lower() == "content-security-policy"
        ):
            self.csp = fields["content"]


report = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
samples = json.loads((ROOT / "samples.json").read_text(encoding="utf-8"))
assert len(samples) == len(report["clips"]) == 3
page = Page()
page.feed((ROOT / "Nabra-Voice-Trial-AR.html").read_text(encoding="utf-8"))
assert len(page.audio) == 3 and not page.active_tags
assert "connect-src 'none'" in page.csp and "script-src 'none'" in page.csp
assert "media-src data:" in page.csp


def strip_marks(text):
    return "".join(c for c in text if not unicodedata.category(c).startswith("M"))


assert strip_marks(samples[0]["text"]) == strip_marks(samples[1]["text"])
for sample, clip, embedded in zip(samples, report["clips"], page.audio, strict=True):
    assert all(clip[key] == value for key, value in sample.items())
    assert re.fullmatch(r"[A-Za-z-]+\.wav", clip["file"])
    data = (ROOT / clip["file"]).read_bytes()
    assert len(data) == clip["bytes"]
    assert hashlib.sha256(data).hexdigest() == clip["sha256"]
    assert embedded["src"].startswith("data:audio/wav;base64,")
    assert base64.b64decode(embedded["src"].split(",", 1)[1], validate=True) == data
    assert embedded["preload"] == "none" and "autoplay" not in embedded
    with wave.open(str(ROOT / clip["file"]), "rb") as wav:
        assert wav.getcomptype() == "NONE"
        assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (
            1,
            2,
            24000,
        )
        assert wav.getnframes() == clip["sampleFrames"]
        pcm = wav.readframes(wav.getnframes())
        assert len(pcm) == wav.getnframes() * 2
        assert wav.readframes(1) == b""
        assert math.isclose(wav.getnframes() / wav.getframerate(), clip["seconds"])
    values = [item[0] for item in struct.iter_unpack("<h", pcm)]
    assert max(map(abs, values)) > 100
    assert max(map(abs, values)) < 32767
    assert clip["clippedSamples"] == 0
    assert all(0 < n < 510 for n in clip["phonemeLengths"])
    print(
        f"Verified {clip['file']}: {clip['seconds']:.3f}s, PCM16/24kHz/mono, exact HTML bytes"
    )
assert report["validation"]["actualModelInference"]
assert report["validation"]["externalFetches"] == 0
assert not report["validation"]["windowsTested"]
assert not report["validation"]["qualityVersusKareemEstablished"]
assert not list(ROOT.rglob("*.onnx")) and not list(ROOT.rglob("*.bin"))
print(
    "Verified three standalone WAVs + all embedded bytes; no model/runtime/network in HTML."
)
