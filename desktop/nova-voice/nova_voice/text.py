"""Script validation and bounded, Arabic-aware segmentation (no GUI dependencies)."""

import re
from dataclasses import dataclass
from pathlib import Path

MAX_CHARACTERS = 100_000
MAX_SCRIPT_BYTES = 2 * 1024 * 1024
CHUNK_CHARACTERS = 480

# Invisible direction/zero-width marks that Arabic copy-paste from web pages
# routinely carries (BOM, ZWSP, RLM/LRM, bidi embeds and isolates). They carry
# no spoken words, so they must never read as unassigned prose; otherwise a
# fully tagged script is refused with a misleading "missing speaker tag"
# error. U+200C (ZWNJ) and U+200D (ZWJ) are preserved: they are meaningful in
# Persian and emoji, and stripping them would alter the text itself.
_INVISIBLE = re.compile(
    "[\u00ad\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]"
)


class ScriptError(ValueError):
    """A user-correctable input error."""


@dataclass(frozen=True)
class TextBlock:
    text: str
    paragraph_end: bool


def validate_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _INVISIBLE.sub("", text).strip()
    if not text or not any(char.isalnum() for char in text):
        raise ScriptError("اكتب نصًا يحتوي على كلمات أو أرقام قبل توليد الصوت.")
    if len(text) > MAX_CHARACTERS:
        raise ScriptError(f"الحد الأقصى للسكريبت هو {MAX_CHARACTERS:,} حرف. قسّم النص إلى أجزاء.")
    if "\x00" in text:
        raise ScriptError("النص يحتوي على محارف غير صالحة. استورده كملف نصي UTF-8.")
    return text


def split_text(text: str, max_chars: int = CHUNK_CHARACTERS) -> list[TextBlock]:
    """Bound even unpunctuated input; preserve word order and paragraph boundaries."""
    if max_chars < 16:
        raise ValueError("max_chars must be at least 16")
    text = validate_text(text)
    result: list[TextBlock] = []
    for paragraph in re.split(r"\n+", text):
        paragraph = re.sub(r"[\t ]+", " ", paragraph).strip()
        if not paragraph:
            continue
        sentences = re.split(r"(?<=[.!?؟؛])\s+", paragraph)
        pieces: list[str] = []
        current = ""
        for sentence in sentences:
            while len(sentence) > max_chars:
                if current:
                    pieces.append(current)
                    current = ""
                boundary = sentence.rfind(" ", 0, max_chars + 1)
                if boundary < max_chars // 3:
                    boundary = max_chars
                pieces.append(sentence[:boundary].strip())
                sentence = sentence[boundary:].strip()
            candidate = f"{current} {sentence}".strip()
            if len(candidate) > max_chars:
                if current:
                    pieces.append(current)
                current = sentence
            else:
                current = candidate
        if current:
            pieces.append(current)
        for index, piece in enumerate(pieces):
            result.append(TextBlock(piece, paragraph_end=index == len(pieces) - 1))
    return result


def preview_text(text: str, limit: int = 400) -> str:
    text = validate_text(text)
    if len(text) <= limit:
        return text
    boundary = text.rfind(" ", 0, limit + 1)
    return text[: boundary if boundary > limit // 2 else limit].strip()


def read_script(path: Path) -> str:
    if path.stat().st_size > MAX_SCRIPT_BYTES:
        raise ScriptError("الملف كبير جدًا. اختر ملف TXT أصغر من 2 ميغابايت.")
    raw = path.read_bytes()
    encoding = "utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
    try:
        text = raw.decode(encoding)
    except UnicodeError as error:
        raise ScriptError(
            "تعذّر قراءة الملف. احفظه بترميز UTF-8 أو UTF-16 ثم حاول مجددًا."
        ) from error
    return validate_text(text)
