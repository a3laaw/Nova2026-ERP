"""Local Piper model discovery/import. There are intentionally no download calls here."""

import json
import re
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from threading import Event
from uuid import uuid4


class VoiceError(ValueError):
    """Missing, incompatible or malformed voice files."""


class Cancelled(Exception):
    """Cooperative cancellation, never a thread termination."""


def check_cancelled(event: Event) -> None:
    if event.is_set():
        raise Cancelled()


@dataclass(frozen=True)
class VoiceSpec:
    model_path: Path
    config_path: Path
    name: str
    language: str
    sample_rate: int
    num_speakers: int
    speakers: tuple[tuple[str, int], ...]
    language_code: str = ""

    @property
    def language_family(self) -> str:
        code = self.language_code or self.model_path.stem.split("-", 1)[0]
        return code.lower().replace("_", "-").split("-", 1)[0]

    @property
    def label(self) -> str:
        return f"{self.name} · {self.language}"

    @classmethod
    def from_path(cls, model_path: Path, config_path: Path | None = None) -> "VoiceSpec":
        config_path = config_path or Path(f"{model_path}.json")
        if not model_path.is_file() or model_path.stat().st_size == 0:
            raise VoiceError("ملف النموذج الصوتي غير موجود أو فارغ.")
        if not config_path.is_file():
            raise VoiceError("ملف الإعداد مفقود. ضع ملف .onnx.json بجانب ملف .onnx.")
        if config_path.stat().st_size > 5 * 1024 * 1024:
            raise VoiceError("ملف إعداد الصوت أكبر من الحجم المتوقع.")
        try:
            data = json.loads(config_path.read_text(encoding="utf-8-sig"))
            if data.get("phoneme_type", "espeak") not in ("espeak", "text"):
                raise VoiceError(
                    "هذا النوع من النماذج غير مدعوم. استخدم نموذج Piper من نوع espeak أو text."
                )
            rate = data["audio"]["sample_rate"]
            count = data["num_speakers"]
            symbols = data["num_symbols"]
            if (
                type(rate) is not int
                or not 8000 <= rate <= 48000
                or type(count) is not int
                or not 1 <= count <= 1000
                or type(symbols) is not int
                or not 1 <= symbols <= 100_000
                or not isinstance(data["espeak"]["voice"], str)
            ):
                raise ValueError("Invalid audio/speaker configuration")
            phonemes = data["phoneme_id_map"]
            if not isinstance(phonemes, dict) or not all(k in phonemes for k in ("_", "^", "$")):
                raise ValueError("Missing phoneme map")
            if not all(
                isinstance(key, str)
                and isinstance(ids, list)
                and ids
                and all(type(i) is int and 0 <= i < symbols for i in ids)
                for key, ids in phonemes.items()
            ):
                raise ValueError("Invalid phoneme ids")
            language_data = data.get("language", {})
            language = str(
                language_data.get("name_native")
                or language_data.get("code")
                or data["espeak"]["voice"]
            )
            speaker_map = data.get("speaker_id_map", {})
            if not isinstance(speaker_map, dict) or not all(
                isinstance(name, str) and type(i) is int and 0 <= i < count
                for name, i in speaker_map.items()
            ):
                raise ValueError("Invalid speaker map")
            speakers = tuple(sorted(speaker_map.items(), key=lambda item: item[1]))
            return cls(
                model_path=model_path.resolve(),
                config_path=config_path.resolve(),
                name=model_path.stem,
                language=language,
                sample_rate=rate,
                num_speakers=count,
                speakers=speakers,
                language_code=str(language_data.get("code") or data["espeak"]["voice"]),
            )
        except VoiceError:
            raise
        except (ValueError, TypeError, KeyError, AttributeError, UnicodeError) as error:
            raise VoiceError("ملف إعداد الصوت غير صالح أو ليس بصيغة Piper المتوافقة.") from error


class VoiceLibrary:
    def __init__(self, user_root: Path, bundled_root: Path):
        self.user_root = user_root
        self.bundled_root = bundled_root

    def scan(self) -> tuple[list[VoiceSpec], list[str]]:
        voices: list[VoiceSpec] = []
        warnings: list[str] = []
        seen: set[Path] = set()
        for root in (self.user_root, self.bundled_root):
            if not root.is_dir():
                continue
            for path in sorted(root.rglob("*.onnx")):
                if any(part.startswith(".") for part in path.relative_to(root).parts):
                    continue
                if path.resolve() in seen:
                    continue
                seen.add(path.resolve())
                try:
                    voices.append(VoiceSpec.from_path(path))
                except (VoiceError, OSError) as error:
                    warnings.append(f"{path.name}: {error}")
        return voices, warnings

    def import_voice(
        self,
        model_path: Path,
        config_path: Path,
        cancel: Event,
        progress: Callable[[int], None],
    ) -> VoiceSpec:
        """Copy into a staging directory, then publish the complete pair atomically."""
        VoiceSpec.from_path(model_path, config_path)
        check_cancelled(cancel)
        self.user_root.mkdir(parents=True, exist_ok=True)
        name = re.sub(r"[^A-Za-z0-9_-]", "_", model_path.stem).strip("_")[:100] or "voice"
        # Unique folders also avoid Windows reserved names and accidental replacements.
        destination = self.user_root / f"voice-{name}-{uuid4().hex[:8]}"
        sources = [(model_path, f"{name}.onnx"), (config_path, f"{name}.onnx.json")]
        for card_name in ("MODEL_CARD", "MODEL_CARD.md"):
            card = model_path.parent / card_name
            if card.is_file() and card.stat().st_size <= 1024 * 1024:
                sources.append((card, card_name))
        total = sum(source.stat().st_size for source, _ in sources)
        copied = 0
        with tempfile.TemporaryDirectory(prefix=".import-", dir=self.user_root) as temporary:
            staging = Path(temporary) / "voice"
            staging.mkdir()
            for source, filename in sources:
                with source.open("rb") as incoming, (staging / filename).open("wb") as outgoing:
                    while block := incoming.read(1024 * 1024):
                        check_cancelled(cancel)
                        outgoing.write(block)
                        copied += len(block)
                        progress(min(99, round(100 * copied / total)))
            check_cancelled(cancel)
            VoiceSpec.from_path(staging / f"{name}.onnx")
            staging.replace(destination)
        progress(100)
        return VoiceSpec.from_path(destination / f"{name}.onnx")
