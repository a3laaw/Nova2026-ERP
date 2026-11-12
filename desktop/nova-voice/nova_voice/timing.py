"""Sample-counted line boundaries and a small, lesson-bound integrity envelope.

Counts describe the final mono PCM stream, including engine-added silence.
They are not word alignment. MP3 encoder/decoder delay is deliberately unknown,
not silently treated as zero; see tools/measure_mp3_delay.py and the guide.
"""

import hashlib
import hmac
import json
import math
import re
from dataclasses import asdict, dataclass

TIMINGS_ID = "nova-whiteboard-timings"
SCHEMA_VERSION = 1
MAX_SAFE_INTEGER = 2**53 - 1
_HEX256 = re.compile(r"[0-9a-f]{64}\Z")


class TimingError(ValueError):
    """Missing, inconsistent or modified timing metadata."""


def data_fingerprint(payload: dict) -> str:
    """The same canonical ASCII JSON/SHA-256 used by the saved lesson manifest."""
    canonical = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("ascii")).hexdigest()


def _integer(value: object, minimum: int = 0, maximum: int = MAX_SAFE_INTEGER) -> bool:
    return type(value) is int and minimum <= value <= maximum


@dataclass(frozen=True)
class LineTiming:
    line_id: int
    speaker: int
    start_sample: int
    end_sample: int
    pause_after_samples: int = 0


@dataclass(frozen=True)
class ClipTiming:
    sample_rate: int
    total_samples: int
    lines: tuple[LineTiming, ...]
    audio_format: str

    @property
    def line_seconds(self) -> tuple[tuple[int, float, float], ...]:
        return tuple(
            (line.line_id, line.start_sample / self.sample_rate, line.end_sample / self.sample_rate)
            for line in self.lines
        )

    def to_data(self) -> dict:
        return {
            "sample_rate": self.sample_rate,
            "total_samples": self.total_samples,
            "audio_format": self.audio_format,
            "clock": "pcm",
            # None explicitly means UNCOMPENSATED, not an assumed zero offset.
            "encoder_delay_samples": 0 if self.audio_format == "wav" else None,
            "lines": [asdict(line) for line in self.lines],
        }

    @classmethod
    def from_data(cls, data: object, speakers: tuple[int, ...]) -> "ClipTiming":
        keys = {
            "sample_rate",
            "total_samples",
            "audio_format",
            "clock",
            "encoder_delay_samples",
            "lines",
        }
        if not isinstance(data, dict) or set(data) != keys:
            raise TimingError("Invalid clip timing fields")
        if (
            not _integer(data["sample_rate"], 8000, 48000)
            or not _integer(data["total_samples"], 1)
            or data["audio_format"] not in ("wav", "mp3")
            or data["clock"] != "pcm"
        ):
            raise TimingError("Invalid PCM timing clock")
        delay = data["encoder_delay_samples"]
        if (data["audio_format"] == "wav" and not (type(delay) is int and delay == 0)) or (
            data["audio_format"] == "mp3" and delay is not None
        ):
            raise TimingError("Unsupported codec-delay compensation")
        values = data["lines"]
        if not isinstance(values, list) or not 1 <= len(values) == len(speakers) <= 720:
            raise TimingError("Missing or extra line timings")
        lines: list[LineTiming] = []
        cursor = 0
        for index, (value, speaker) in enumerate(zip(values, speakers, strict=True)):
            if not isinstance(value, dict) or set(value) != {
                "line_id",
                "speaker",
                "start_sample",
                "end_sample",
                "pause_after_samples",
            }:
                raise TimingError("Invalid line timing fields")
            if not all(_integer(item) for item in value.values()):
                raise TimingError("Timing values must be safe, nonnegative integers")
            if (
                value["line_id"] != index
                or value["speaker"] not in (1, 2)
                or value["speaker"] != speaker
                or value["start_sample"] != cursor
                or not cursor < value["end_sample"] <= data["total_samples"]
            ):
                raise TimingError("Line timings do not match the lesson or PCM order")
            line = LineTiming(**value)
            lines.append(line)
            cursor = line.end_sample + line.pause_after_samples
        if cursor != data["total_samples"] or lines[-1].pause_after_samples != 0:
            raise TimingError("Line spans and pauses must cover the complete PCM stream")
        return cls(data["sample_rate"], data["total_samples"], tuple(lines), data["audio_format"])


@dataclass(frozen=True)
class TimingMap:
    lesson_fingerprint: str
    steps: tuple[ClipTiming, ...]

    def to_data(self) -> dict:
        payload = {
            "schema_version": SCHEMA_VERSION,
            "lesson_fingerprint": self.lesson_fingerprint,
            "steps": {str(index): step.to_data() for index, step in enumerate(self.steps)},
        }
        return payload | {"fingerprint": data_fingerprint(payload)}

    @classmethod
    def from_data(
        cls,
        data: object,
        lesson_fingerprint: str,
        speakers: tuple[tuple[int, ...], ...],
        durations: list[float],
    ) -> "TimingMap":
        if not isinstance(data, dict) or set(data) != {
            "schema_version",
            "lesson_fingerprint",
            "steps",
            "fingerprint",
        }:
            raise TimingError("Invalid timing-map fields")
        if type(data["schema_version"]) is not int or data["schema_version"] != SCHEMA_VERSION:
            raise TimingError("Unsupported timing schema")
        if (
            not isinstance(data["lesson_fingerprint"], str)
            or not _HEX256.fullmatch(data["lesson_fingerprint"])
            or not hmac.compare_digest(data["lesson_fingerprint"], lesson_fingerprint)
        ):
            raise TimingError("Timing map belongs to another lesson")
        if (
            not isinstance(data["steps"], dict)
            or not 1 <= len(speakers) <= 120
            or any(not 1 <= len(roles) <= 6 for roles in speakers)
            or set(data["steps"]) != {str(index) for index in range(len(speakers))}
            or not isinstance(durations, list)
            or len(durations) != len(speakers)
        ):
            raise TimingError("Missing or extra timing steps")
        steps: list[ClipTiming] = []
        for index, roles in enumerate(speakers):
            clip = ClipTiming.from_data(data["steps"][str(index)], roles)
            duration = durations[index]
            if (
                type(duration) not in (int, float)
                or not math.isfinite(duration)
                or duration <= 0
                or abs(duration * clip.sample_rate - clip.total_samples) > 1
            ):
                raise TimingError("Timing map and recording duration disagree")
            steps.append(clip)
        fingerprint = data["fingerprint"]
        payload = {key: value for key, value in data.items() if key != "fingerprint"}
        if (
            not isinstance(fingerprint, str)
            or not _HEX256.fullmatch(fingerprint)
            or not hmac.compare_digest(fingerprint, data_fingerprint(payload))
        ):
            raise TimingError("Timing fingerprint mismatch")
        return cls(lesson_fingerprint, tuple(steps))
