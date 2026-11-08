"""Deterministic, offline script -> whiteboard HTML -> narrated whiteboard HTML.

No language model, HTML execution or network is involved. Only the saved lesson's
manifest is used for speech; titles and structural markers are never pronounced.
"""

import argparse
import base64
import hashlib
import hmac
import json
import math
import os
import re
import tempfile
from collections.abc import Callable, Mapping
from dataclasses import asdict, dataclass, replace
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from threading import Event

from .dialogue import DialogueTurn, has_voice_markers, parse_dialogue
from .engine import (
    DialogueVoice,
    RenderOptions,
    SpeechEngine,
    validate_dialogue_cast,
)
from .html_export import (
    BASE64_CHUNK_BYTES,
    MAX_AUDIO_BYTES,
    MAX_HTML_BYTES,
    HtmlAudioResult,
    HtmlExportError,
    HtmlPage,
    validate_destination,
)
from .storage import resource_dir
from .text import ScriptError, read_script, split_text, validate_text
from .voices import VoiceError, check_cancelled

MAX_STEPS = 120
ROWS_PER_STEP = 6
ROW_CHARACTERS = 180
MAX_TITLE = 120
WHITEBOARD_EXAMPLE = """# التحيات والتعارف
## أهلًا بكم
[1] أهلًا بكم! اليوم نتعلّم كيف نحيّي الآخرين ونقدّم أنفسنا.
[2] Greetings and introductions.
## التحيات
[2] Hello!
[1] مرحبًا!
[2] Good morning!
[1] صباح الخير!
[2] How are you?
[1] كيف حالك؟
## اللقاء والوداع
[2] I am fine, thank you.
[1] أنا بخير، شكرًا لك.
[2] Nice to meet you.
[1] سعدتُ بلقائك.
[2] See you later!
[1] أراك لاحقًا!
## تقديم النفس
[2] My name is Sara.
[1] اسمي سارة.
[2] I am from Egypt.
[1] أنا من مصر.
[2] I am in Primary Three.
[1] أنا في الصف الثالث الابتدائي.
## تدرّب مع صديقك
[1] اسأل صديقك عن اسمه، ثم بدّلا الأدوار.
[2] Good morning! What is your name?
[2] My name is Sara. Nice to meet you!
## فكّر وأجب
[1] أي عبارة نستخدمها في الصباح؟ أوقف الدرس وفكّر قبل الانتقال إلى الحل.
[2] Good morning! Or, see you later?
## الحل
[1] الإجابة الصحيحة هي صباح الخير. أحسنتم!
[2] Good morning!
"""

DATA_ID = "nova-whiteboard-data"
RECORDINGS_ID = "nova-whiteboard-recordings"
AUDIO_MARKER = "<!-- NOVA_WHITEBOARD_AUDIO_V1 -->"


class WhiteboardError(ScriptError):
    """A script or saved Nova lesson needs correcting before export."""


@dataclass(frozen=True)
class BoardRow:
    speaker: int
    text: str


@dataclass(frozen=True)
class BoardStep:
    title: str
    rows: tuple[BoardRow, ...]

    def speech(self, dialogue: bool) -> str:
        return "\n".join(
            f"[{row.speaker}] {row.text}" if dialogue else row.text for row in self.rows
        )


@dataclass(frozen=True)
class Lesson:
    script: str
    title: str
    dialogue: bool
    steps: tuple[BoardStep, ...]

    @property
    def spoken_script(self) -> str:
        return "\n".join(step.speech(self.dialogue) for step in self.steps)

    @property
    def characters(self) -> int:
        return sum(len(row.text) for step in self.steps for row in step.rows)

    @property
    def speakers(self) -> set[int]:
        return {row.speaker for step in self.steps for row in step.rows}

    def manifest(self) -> dict:
        payload = {"schema": 1, **asdict(self)}
        # Convert tuples to JSON's list representation before equality checks.
        payload = json.loads(json.dumps(payload, ensure_ascii=True))
        return {**payload, "fingerprint": _fingerprint(payload)}


@dataclass(frozen=True)
class WhiteboardResult:
    path: Path
    lesson: Lesson


@dataclass(frozen=True)
class WhiteboardPage:
    page: HtmlPage
    lesson: Lesson

    @classmethod
    def load(cls, source: Path) -> "WhiteboardPage":
        page = HtmlPage.load(source)
        inspector = _ManifestInspector()
        inspector.feed(page.content)
        inspector.close()
        if inspector.recordings:
            raise WhiteboardError(
                "هذه سبورة بالصوت بالفعل. اختر نسخة السبورة الأصلية بلا صوت لإعادة التوليد."
            )
        if len(inspector.manifests) != 1 or page.content.count(AUDIO_MARKER) != 1:
            raise WhiteboardError(
                "هذا ليس ملف سبورة Nova المدعوم. أنشئ السبورة من السكريبت في الخطوة 1، "
                "أو استخدم قسم إضافة الصوت إلى HTML للصفحات الأخرى."
            )
        try:
            manifest = json.loads(inspector.manifests[0])
            if not isinstance(manifest, dict) or (
                type(manifest.get("schema")) is not int or manifest["schema"] != 1
            ):
                raise ValueError("Unsupported schema")
            if type(manifest.get("dialogue")) is not bool:
                raise ValueError("Invalid dialogue flag")
            if not isinstance(manifest.get("script"), str):
                raise ValueError("Missing script")
            lesson = parse_lesson(manifest["script"], dialogue=manifest["dialogue"])
            expected = lesson.manifest()
            if not isinstance(manifest.get("fingerprint"), str):
                raise ValueError("Missing fingerprint")
            if not hmac.compare_digest(manifest["fingerprint"], expected["fingerprint"]):
                raise ValueError("Changed lesson")
            if manifest != expected:
                raise ValueError("Inconsistent lesson data")
        except (ValueError, TypeError, KeyError, RecursionError) as error:
            raise WhiteboardError(
                "بيانات الدرس ناقصة أو تغيّرت. أعد توليد السبورة من السكريبت في الخطوة 1."
            ) from error
        return cls(page, lesson)


class _ManifestInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.manifests: list[str] = []
        self.recordings = False
        self._collecting = False
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "script":
            return
        attributes = dict(attrs)
        if attributes.get("id") == RECORDINGS_ID:
            self.recordings = True
        if attributes.get("id") == DATA_ID:
            if attributes.get("type") != "application/json":
                raise WhiteboardError("بيانات السبورة ليست بالصيغة المدعومة.")
            self._collecting = True
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._collecting:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._collecting:
            self.manifests.append("".join(self._parts))
            self._collecting = False


def _fingerprint(payload: dict) -> str:
    canonical = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("ascii")).hexdigest()


def _heading(value: str) -> str:
    if has_voice_markers(value):
        raise WhiteboardError(
            "العناوين لا تحتاج وسوم أصوات. احذف الوسوم من العنوان وضعها في محتوى الخطوة فقط."
        )
    if not value or not any(char.isalnum() for char in value) or len(value) > MAX_TITLE:
        raise WhiteboardError(f"اكتب عنوانًا واضحًا لا يزيد على {MAX_TITLE} حرفًا.")
    return value


def parse_lesson(script: str, *, dialogue: bool = False) -> Lesson:
    """# title, ## step; otherwise blank-line-separated paragraphs become steps.

    In dialogue mode [1]/[2] tags assign voices on separate lines or inline;
    optional matching [/1]/[/2] tags are structural, never displayed or spoken.
    Without dialogue, each content line is narrated by role 1. Long rows and
    steps are paginated, never discarded. This is not semantic AI scene design.
    """
    try:
        script = validate_text(script)
    except ScriptError as error:
        raise WhiteboardError(str(error).replace("توليد الصوت", "توليد السبورة")) from error
    title = "درس جديد"
    sections: list[tuple[str, list[str]]] = []
    current_title = ""
    current: list[str] = []
    has_steps = False
    has_title = False
    body_seen = False

    def finish() -> None:
        nonlocal current
        if not any(line.strip() for line in current):
            if current_title:
                raise WhiteboardError(f"الخطوة «{current_title}» فارغة. أضف نصها أسفل العنوان.")
            return
        sections.append((current_title, current))
        current = []

    for line in script.splitlines():
        stripped = line.strip()
        match = re.match(r"^(#{1,})\s+(.*)$", stripped)
        if stripped in ("#", "##"):
            raise WhiteboardError("أضف نص العنوان بعد # أو ##.")
        if match:
            level, heading = len(match[1]), _heading(match[2].strip())
            if level == 1:
                if has_title or body_seen or has_steps:
                    raise WhiteboardError("استخدم # لعنوان الدرس مرة واحدة وفي بداية السكريبت.")
                title, has_title = heading, True
            elif level == 2:
                finish()
                current_title = heading
                has_steps = True
            else:
                raise WhiteboardError("استخدم # لعنوان الدرس و## لعنوان كل خطوة فقط.")
        else:
            if stripped:
                body_seen = True
            current.append(line)
    finish()
    if not sections:
        raise WhiteboardError("أضف محتوى الدرس أسفل العناوين قبل توليد السبورة.")
    if not has_steps:
        content = "\n".join(sections[0][1])
        sections = [
            ("", block.splitlines()) for block in re.split(r"\n\s*\n", content) if block.strip()
        ]

    steps: list[BoardStep] = []
    for name, lines in sections:
        # Markdown bullet decoration is structural, not part of spoken content.
        lines = [re.sub(r"^\s*[-*]\s+", "", line) for line in lines]
        lines = [line for line in lines if not re.fullmatch(r"\s*[-*_]{3,}\s*", line)]
        if dialogue:
            turns = parse_dialogue("\n".join(lines))
            source_rows = [(turn.speaker, turn.text) for turn in turns]
        else:
            if has_voice_markers("\n".join(lines)):
                raise WhiteboardError(
                    "الدرس يحتوي وسوم متحدثين. اختر «حوار بين صوتين» قبل الخطوة 1."
                )
            source_rows = [(1, line.strip()) for line in lines if line.strip()]
        rows = tuple(
            BoardRow(speaker, piece.text)
            for speaker, text in source_rows
            for piece in split_text(text, max_chars=ROW_CHARACTERS)
        )
        if not rows:
            raise WhiteboardError("إحدى خطوات الدرس بلا كلمات. أضف محتواها ثم حاول مجددًا.")
        name = name or f"الخطوة {len(steps) + 1}"
        for offset in range(0, len(rows), ROWS_PER_STEP):
            page_title = name if not offset else f"{name} · متابعة {offset // ROWS_PER_STEP + 1}"
            steps.append(BoardStep(page_title, rows[offset : offset + ROWS_PER_STEP]))
            if len(steps) > MAX_STEPS:
                raise WhiteboardError(f"الدرس أطول من {MAX_STEPS} خطوة. قسّم السكريبت إلى دروس.")
    return Lesson(script, title, dialogue, tuple(steps))


def _safe_json(value: object) -> str:
    return (
        json.dumps(value, ensure_ascii=True, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace("&", "\\u0026")
    )


def whiteboard_html(lesson: Lesson) -> str:
    assets = resource_dir() / "assets"
    template = (assets / "whiteboard.html").read_text(encoding="utf-8")
    css = (assets / "whiteboard.css").read_text(encoding="utf-8")
    controller = (assets / "whiteboard.js").read_text(encoding="utf-8")
    if "</script" in controller.lower() or "</style" in css.lower():
        raise WhiteboardError("ملفات قالب السبورة غير صالحة. استخدم حزمة Nova Voice كاملة.")
    accessible = "".join(
        "<section><h2>"
        + escape(step.title)
        + "</h2>"
        + "".join('<p dir="auto">' + escape(row.text) + "</p>" for row in step.rows)
        + "</section>"
        for step in lesson.steps
    )
    values = {
        "TITLE": escape(lesson.title),
        "CSS": css,
        "SCRIPT": controller,
        "DATA": _safe_json(lesson.manifest()),
        "FALLBACK": accessible,
        "AUDIO": AUDIO_MARKER,
    }
    tokens = re.findall(r"@@NOVA_([A-Z_]+)@@", template)
    if set(tokens) != set(values) or any(
        tokens.count(key) != (2 if key == "TITLE" else 1) for key in values
    ):
        raise WhiteboardError("قالب السبورة ناقص. استخدم حزمة Nova Voice كاملة.")
    result = re.sub(r"@@NOVA_([A-Z_]+)@@", lambda match: values[match[1]], template)
    if len(result.encode("utf-8")) > MAX_HTML_BYTES:
        raise WhiteboardError("السبورة أكبر من الحد المسموح. قسّم الدرس إلى أجزاء.")
    return result


def _atomic_write(destination: Path, writer: Callable, cancel: Event) -> Path:
    destination = destination.expanduser().absolute()
    if destination.suffix.lower() not in (".html", ".htm"):
        raise WhiteboardError("احفظ السبورة بامتداد HTML أو HTM.")
    check_cancelled(cancel)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".nova-whiteboard-", dir=destination.parent)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(b"\xef\xbb\xbf")
            writer(output)
            output.flush()
            os.fsync(output.fileno())
        check_cancelled(cancel)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return destination


def save_whiteboard(
    lesson: Lesson,
    destination: Path,
    cancel: Event | None = None,
    progress: Callable[[int], None] | None = None,
) -> WhiteboardResult:
    cancel = cancel if cancel is not None else Event()
    progress = progress or (lambda _: None)
    check_cancelled(cancel)
    content = whiteboard_html(lesson).encode("utf-8")
    progress(50)
    path = _atomic_write(destination, lambda output: output.write(content), cancel)
    progress(100)
    return WhiteboardResult(path, lesson)


def validate_lesson_cast(
    lesson: Lesson, cast: Mapping[int, DialogueVoice], options: RenderOptions
) -> None:
    if lesson.dialogue:
        validate_dialogue_cast(
            [DialogueTurn(row.speaker, row.text) for step in lesson.steps for row in step.rows],
            cast,
            options,
        )
    else:
        if 1 not in cast:
            raise VoiceError("اختر نموذج الراوي قبل توليد صوت السبورة.")
        replace(options, speaker_id=cast[1].speaker_id).validate(cast[1].voice)


def render_whiteboard_audio(
    engine: SpeechEngine,
    source: Path,
    cast: Mapping[int, DialogueVoice],
    destination: Path,
    options: RenderOptions,
    cancel: Event | None = None,
    progress: Callable[[int], None] | None = None,
    *,
    turn_pause_ms: int = 350,
    audio_format: str = "mp3",
) -> HtmlAudioResult:
    """Read saved script, generate one clip PER STEP, stream them into a new copy."""
    cancel = cancel if cancel is not None else Event()
    progress = progress or (lambda _: None)
    check_cancelled(cancel)
    board = WhiteboardPage.load(source)
    validate_destination(board.page.source, destination)
    validate_lesson_cast(board.lesson, cast, options)
    if audio_format not in ("mp3", "wav"):
        raise WhiteboardError("اختر MP3 أو WAV للصوت المضمّن في السبورة.")
    if not 0 <= turn_pause_ms <= 2000:
        raise WhiteboardError("فاصل الردود يجب أن يكون بين 0 و2000 ملّي ثانية.")
    clips: list[tuple[Path, float, int]] = []
    completed = 0
    audio_bytes = 0
    total = board.lesson.characters
    with tempfile.TemporaryDirectory(prefix="nova-whiteboard-speech-") as folder:
        for index, step in enumerate(board.lesson.steps):
            check_cancelled(cancel)
            text = step.speech(board.lesson.dialogue)
            weight = sum(len(row.text) for row in step.rows)

            def speech_progress(value: int, completed=completed, weight=weight) -> None:
                if value < 0:
                    progress(-1 if not completed else round(85 * completed / total))
                else:
                    progress(min(85, round(85 * (completed + weight * value / 100) / total)))

            clip = Path(folder) / f"step-{index}.{audio_format}"
            if board.lesson.dialogue:
                result = engine.render_dialogue(
                    text,
                    cast,
                    clip,
                    options,
                    cancel,
                    speech_progress,
                    turn_pause_ms=turn_pause_ms,
                )
            else:
                result = engine.render(
                    text,
                    cast[1].voice,
                    clip,
                    replace(options, speaker_id=cast[1].speaker_id),
                    cancel,
                    speech_progress,
                )
            size = clip.stat().st_size
            if (
                not size
                or not math.isfinite(result.duration_seconds)
                or result.duration_seconds <= 0
            ):
                raise WhiteboardError("لم ينتج أحد مقاطع الدرس صوتًا صالحًا.")
            audio_bytes += size
            if audio_bytes > MAX_AUDIO_BYTES:
                raise WhiteboardError("صوت الدرس أكبر من 256 ميغابايت. اختر MP3 أو قسّم الدرس.")
            clips.append((clip, result.duration_seconds, size))
            completed += weight
        check_cancelled(cancel)
        prefix, suffix = board.page.content.split(AUDIO_MARKER)
        durations = [duration for _, duration, _ in clips]
        mime = "audio/mpeg" if audio_format == "mp3" else "audio/wav"
        written = 0

        def write(output) -> None:
            nonlocal written
            output.write(prefix.encode("utf-8"))
            output.write(
                (
                    f'<script id="{RECORDINGS_ID}" type="application/json">'
                    + _safe_json({"durations": durations})
                    + "</script>\n"
                ).encode("ascii")
            )
            for index, (clip, _, expected) in enumerate(clips):
                output.write(
                    (
                        f'<script id="nova-wb-audio-{index}" '
                        f'type="application/x-nova-audio" data-mime="{mime}">'
                    ).encode("ascii")
                )
                count = 0
                with clip.open("rb") as audio:
                    while block := audio.read(BASE64_CHUNK_BYTES):
                        check_cancelled(cancel)
                        count += len(block)
                        written += len(block)
                        if count > expected:
                            raise WhiteboardError("تغيّر ملف الصوت أثناء الحفظ. حاول مجددًا.")
                        output.write(base64.b64encode(block))
                        progress(min(99, 85 + round(15 * written / audio_bytes)))
                if count != expected:
                    raise WhiteboardError("لم تكتمل قراءة صوت إحدى الخطوات.")
                output.write(b"</script>\n")
            output.write(suffix.encode("utf-8"))

        path = _atomic_write(destination, write, cancel)
    progress(100)
    return HtmlAudioResult(path, sum(durations), total, audio_bytes)


def main() -> None:
    parser = argparse.ArgumentParser(description="سكريبت TXT إلى سبورة HTML محلية بلا صوت.")
    parser.add_argument("script", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--dialogue", action="store_true", help="تفعيل وسوم [1]/[2]")
    args = parser.parse_args()
    try:
        lesson = parse_lesson(read_script(args.script), dialogue=args.dialogue)
        result = save_whiteboard(lesson, args.output)
    except (OSError, ScriptError, HtmlExportError) as error:
        parser.exit(1, f"{error}\n")
    print(f"Saved {len(lesson.steps)} steps: {result.path}")


if __name__ == "__main__":
    main()
