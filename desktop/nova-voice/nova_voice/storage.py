"""Local preferences only. Script contents are never persisted or logged."""

import json
import os
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class Preferences:
    voice_path: str = ""
    speed: float = 1.0
    pause_ms: int = 250
    audio_format: str = "mp3"
    output_dir: str = ""
    mode: str = "single"
    language: str = "all"
    speaker_id: int = 0
    second_voice_path: str = ""
    second_language: str = "en"
    second_speaker_id: int = 0
    turn_pause_ms: int = 350


def user_data_dir() -> Path:
    override = os.environ.get("NOVA_VOICE_HOME")
    if override:
        return Path(override).expanduser()
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "NovaVoice"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "NovaVoice"


def application_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parents[1]


def resource_dir() -> Path:
    return Path(getattr(sys, "_MEIPASS", application_dir()))


def load_preferences(directory: Path) -> Preferences:
    try:
        data = json.loads((directory / "settings.json").read_text(encoding="utf-8"))
        return Preferences(
            voice_path=str(data.get("voice_path", "")),
            speed=max(0.6, min(1.6, float(data.get("speed", 1.0)))),
            pause_ms=max(0, min(1500, int(data.get("pause_ms", 250)))),
            audio_format="wav" if data.get("audio_format") == "wav" else "mp3",
            output_dir=str(data.get("output_dir", "")),
            mode="dialogue" if data.get("mode") == "dialogue" else "single",
            language=data.get("language") if data.get("language") in ("ar", "en") else "all",
            speaker_id=max(0, min(999, int(data.get("speaker_id", 0)))),
            second_voice_path=str(data.get("second_voice_path", "")),
            second_language=(
                data.get("second_language", "en")
                if data.get("second_language", "en") in ("ar", "en", "all")
                else "en"
            ),
            second_speaker_id=max(0, min(999, int(data.get("second_speaker_id", 0)))),
            turn_pause_ms=max(0, min(2000, int(data.get("turn_pause_ms", 350)))),
        )
    except (OSError, ValueError, TypeError, AttributeError):
        return Preferences()


def save_preferences(directory: Path, preferences: Preferences) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".settings-", dir=directory)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(asdict(preferences), handle, ensure_ascii=False, indent=2)
        temporary.replace(directory / "settings.json")
    finally:
        temporary.unlink(missing_ok=True)
