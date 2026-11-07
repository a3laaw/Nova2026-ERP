"""Add offline audio/controls to a COPY of a local HTML page without running its scripts."""

import base64
import json
import os
import tempfile
from array import array
from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from html.parser import HTMLParser
from pathlib import Path
from threading import Event
from uuid import uuid4

from . import __version__
from .engine import DialogueVoice, RenderOptions, SpeechEngine
from .storage import resource_dir
from .voices import VoiceError, check_cancelled

MAX_HTML_BYTES = 25 * 1024 * 1024
MAX_AUDIO_BYTES = 256 * 1024 * 1024
BASE64_CHUNK_BYTES = 3 * 64 * 1024  # Complete base64 groups, including across read boundaries.


class HtmlExportError(ValueError):
    """A page cannot safely be augmented automatically."""


class _PageInspector(HTMLParser):
    """Locate actual closing tags, not strings such as '</body>' inside a script."""

    IGNORED_SCOPES = {
        "template",
        "noscript",
        "svg",
        "math",
        "script",
        "style",
        "textarea",
        "title",
        "xmp",
        "iframe",
        "noembed",
        "plaintext",
    }

    def __init__(self, content: str):
        super().__init__(convert_charrefs=False)
        self.line_offsets = array("I", [0])
        self.line_offsets.extend(i + 1 for i, char in enumerate(content) if char == "\n")
        self.scopes: dict[str, int] = {}
        self.body_end: int | None = None
        self.html_end: int | None = None
        self.has_csp = False
        self.has_player = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "plaintext":
            raise ValueError("The legacy plaintext element cannot host a following player")
        if tag in self.IGNORED_SCOPES:
            self.scopes[tag] = self.scopes.get(tag, 0) + 1
        if any(self.scopes.values()):
            return
        attributes = dict(attrs)
        if (
            tag == "meta"
            and (attributes.get("http-equiv") or "").lower().strip() == "content-security-policy"
        ):
            if (attributes.get("content") or "").strip():
                self.has_csp = True
        if tag == "nova-voice-player":
            self.has_player = True

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        # Self-closing SVG/template tags must not hide the rest of the document.
        if tag in {"script", "style", "textarea", "title", "xmp", "iframe", "noembed", "plaintext"}:
            if not any(self.scopes.values()):
                raise ValueError("A raw-text element needs an explicit closing tag")
        if tag not in self.IGNORED_SCOPES:
            self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag in self.IGNORED_SCOPES:
            self.scopes[tag] = max(0, self.scopes.get(tag, 0) - 1)
            return
        if any(self.scopes.values()):
            return
        line, column = self.getpos()
        offset = self.line_offsets[line - 1] + column
        if tag == "body" and self.body_end is None:
            self.body_end = offset
        elif tag == "html" and self.html_end is None:
            self.html_end = offset


@dataclass(frozen=True)
class HtmlPage:
    source: Path
    content: str
    insertion_offset: int

    @classmethod
    def load(cls, source: Path) -> "HtmlPage":
        if source.suffix.lower() not in (".html", ".htm"):
            raise HtmlExportError("اختر ملفًا بامتداد HTML أو HTM.")
        if source.stat().st_size > MAX_HTML_BYTES:
            raise HtmlExportError("ملف HTML كبير جدًا. الحد الأقصى 25 ميغابايت قبل إضافة الصوت.")
        raw = source.read_bytes()
        if len(raw) > MAX_HTML_BYTES:
            raise HtmlExportError("ملف HTML أكبر من الحد المسموح.")
        encoding = "utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
        try:
            content = raw.decode(encoding)
        except UnicodeError as error:
            raise HtmlExportError(
                "احفظ صفحة HTML بترميز UTF-8 أو UTF-16 ثم اخترها مجددًا."
            ) from error
        if not content.strip() or "\x00" in content:
            raise HtmlExportError("ملف HTML فارغ أو يحتوي بيانات غير صالحة.")
        parser = _PageInspector(content)
        try:
            parser.feed(content)
            parser.close()
            if any(parser.scopes.values()):
                raise ValueError("An unclosed element would hide the added audio player")
        except (ValueError, AssertionError) as error:
            raise HtmlExportError("تعذّر قراءة بنية HTML. راجع الملف قبل إضافة الصوت.") from error
        if parser.has_csp:
            raise HtmlExportError(
                "تحتوي الصفحة سياسة أمان CSP قد تمنع الصوت المضمّن أو السكريبت. "
                "لن يغيّر البرنامج سياسة الأمان تلقائيًا؛ يلزم دمج مخصص يراعي سياسة الصفحة."
            )
        if parser.has_player:
            raise HtmlExportError(
                "تحتوي الصفحة مشغّل Nova Voice بالفعل. اختر ملف HTML الأصلي لتحديث الصوت."
            )
        offset = parser.body_end if parser.body_end is not None else parser.html_end
        return cls(source.resolve(), content, offset if offset is not None else len(content))


@dataclass(frozen=True)
class HtmlAudioResult:
    path: Path
    duration_seconds: float
    characters: int
    audio_bytes: int


def validate_destination(source: Path, destination: Path) -> None:
    source = source.expanduser().resolve()
    destination = destination.expanduser()
    if destination.suffix.lower() not in (".html", ".htm"):
        raise HtmlExportError("احفظ النسخة الجديدة بامتداد HTML أو HTM.")
    if source == destination.resolve() or (destination.exists() and source.samefile(destination)):
        raise HtmlExportError("لا يمكن استبدال ملف HTML الأصلي. اختر اسمًا آخر للنسخة الصوتية.")


def _controller_source() -> str:
    assets = resource_dir() / "assets"
    script = (assets / "html-player.js").read_text(encoding="utf-8")
    css = (assets / "html-player.css").read_text(encoding="utf-8")
    if script.count("__NOVA_PLAYER_CSS__") != 1 or not css.strip():
        raise HtmlExportError("ملفات مشغّل HTML ناقصة. استخدم حزمة Nova Voice كاملة.")
    # JSON is embedded in an HTML raw-text script element, not just JavaScript.
    safe_css = json.dumps(css, ensure_ascii=True).replace("<", "\\u003c").replace("&", "\\u0026")
    script = script.replace("__NOVA_PLAYER_CSS__", safe_css)
    if "</script" in script.lower():
        raise HtmlExportError("تعذّر تجهيز مشغّل HTML بأمان.")
    return script


def embed_audio(
    page: HtmlPage,
    audio_path: Path,
    destination: Path,
    cancel: Event | None = None,
    progress: Callable[[int], None] | None = None,
) -> Path:
    """Embed one audio stream, preserving source text/relative links and atomic output."""
    cancel = cancel if cancel is not None else Event()
    progress = progress or (lambda _: None)
    validate_destination(page.source, destination)
    check_cancelled(cancel)
    mime = {".mp3": "audio/mpeg", ".wav": "audio/wav"}.get(audio_path.suffix.lower())
    if mime is None:
        raise HtmlExportError("تصدير HTML يدعم الصوت بصيغتي MP3 وWAV فقط.")
    size = audio_path.stat().st_size
    if not 0 < size <= MAX_AUDIO_BYTES:
        raise HtmlExportError("الصوت فارغ أو أكبر من 256 ميغابايت. اختر MP3 أو قسّم السكريبت.")
    controller = _controller_source()
    identifier = "nova-voice-" + uuid4().hex
    destination = destination.expanduser().absolute()
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".nova-html-", dir=destination.parent)
    temporary = Path(name)
    written = 0
    try:
        with os.fdopen(fd, "wb") as output:
            # UTF-8 BOM takes precedence over any legacy charset declaration that
            # belongs to the original page, without rewriting its markup/scripts.
            output.write(b"\xef\xbb\xbf")
            output.write(page.content[: page.insertion_offset].encode("utf-8"))
            output.write(
                (
                    f'\n<nova-voice-player id="{identifier}" '
                    f'data-nova-voice-player="{__version__}">\n'
                    '<audio controls preload="metadata" data-nova-voice-audio '
                    f'aria-label="صوت الصفحة" src="data:{mime};base64,'
                ).encode()
            )
            with audio_path.open("rb") as audio:
                while block := audio.read(BASE64_CHUNK_BYTES):
                    check_cancelled(cancel)
                    written += len(block)
                    if written > size or written > MAX_AUDIO_BYTES:
                        raise HtmlExportError("تغيّر ملف الصوت أثناء التصدير. حاول مجددًا.")
                    output.write(base64.b64encode(block))
                    progress(min(99, round(100 * written / size)))
            if written != size:
                raise HtmlExportError("لم تكتمل قراءة الملف الصوتي. لم تُحفظ نسخة ناقصة.")
            output.write(
                (
                    '">متصفحك لا يدعم تشغيل الصوت.</audio>\n'
                    "<noscript>استخدم مشغّل الصوت؛ "
                    "التحكم بحركات الصفحة يحتاج JavaScript.</noscript>\n"
                    "</nova-voice-player>\n<script data-nova-voice-controller>\n"
                    + controller
                    + "\n</script>\n"
                ).encode("utf-8")
            )
            output.write(page.content[page.insertion_offset :].encode("utf-8"))
            output.flush()
            os.fsync(output.fileno())
        check_cancelled(cancel)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    progress(100)
    return destination


def render_html(
    engine: SpeechEngine,
    html_source: Path,
    script: str,
    cast: Mapping[int, DialogueVoice],
    destination: Path,
    options: RenderOptions,
    cancel: Event | None = None,
    progress: Callable[[int], None] | None = None,
    *,
    dialogue: bool = False,
    turn_pause_ms: int = 350,
    audio_format: str = "mp3",
) -> HtmlAudioResult:
    """One background operation: preflight HTML, synthesize, then embed the audio."""
    cancel = cancel if cancel is not None else Event()
    progress = progress or (lambda _: None)
    check_cancelled(cancel)
    page = HtmlPage.load(html_source)
    validate_destination(page.source, destination)
    if audio_format not in ("mp3", "wav"):
        raise HtmlExportError("اختر MP3 أو WAV لتوليد الصفحة الصوتية.")

    def speech_progress(value: int) -> None:
        progress(-1 if value < 0 else round(value * 0.85))

    with tempfile.TemporaryDirectory(prefix="nova-voice-html-audio-") as folder:
        audio = Path(folder) / f"narration.{audio_format}"
        if dialogue:
            result = engine.render_dialogue(
                script, cast, audio, options, cancel, speech_progress, turn_pause_ms=turn_pause_ms
            )
        else:
            if 1 not in cast:
                raise VoiceError("اختر نموذجًا للراوي قبل توليد الصفحة.")
            result = engine.render(
                script,
                cast[1].voice,
                audio,
                replace(options, speaker_id=cast[1].speaker_id),
                cancel,
                speech_progress,
            )
        check_cancelled(cancel)
        size = audio.stat().st_size
        path = embed_audio(
            page, audio, destination, cancel, lambda value: progress(85 + round(value * 0.15))
        )
        return HtmlAudioResult(path, result.duration_seconds, result.characters, size)
