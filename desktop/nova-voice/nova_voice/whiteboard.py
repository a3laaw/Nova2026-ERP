"""Deterministic, offline script -> whiteboard HTML -> narrated whiteboard HTML.

Rendering and speech remain offline. Optional reviewed visual plans contain only
declarative data; no generated HTML/code is executed. Titles are never pronounced.
"""

import argparse
import base64
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

from .appearance import (
    CATALOG_ID,
    STYLE_ID,
    AppearanceError,
    BoardAppearance,
    character_catalog,
    character_templates,
)
from .azure_speech import CloudRequest
from .dialogue import DialogueTurn, has_voice_markers, merge_turns, parse_dialogue
from .engine import (
    DialogueVoice,
    RenderOptions,
    SpeechEngine,
    SpeechLine,
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
from .language import narration_text, text_language, validate_spoken_language
from .scenes import SceneError, VisualPlan, review_text
from .storage import resource_dir
from .text import ScriptError, read_script, split_text, validate_text
from .timing import TIMINGS_ID, ClipTiming, TimingMap, data_fingerprint
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
        turns = merge_turns(
            [DialogueTurn(row.speaker, narration_text(row.text)) for row in self.rows]
        )
        if dialogue:
            return "\n".join(f"[{turn.speaker}] {turn.text}" for turn in turns)
        return " ".join(turn.text for turn in turns)


@dataclass(frozen=True)
class Lesson:
    script: str
    title: str
    dialogue: bool
    steps: tuple[BoardStep, ...]
    visuals: VisualPlan | None = None

    def effective_rows(self, index: int, *, speech: bool = False) -> tuple[BoardRow, ...]:
        rows = self.steps[index].rows
        if self.visuals is None:
            return rows
        return tuple(
            BoardRow(row.speaker, self.visuals.row_text(index, number, row.text, speech=speech))
            for number, row in enumerate(rows)
        )

    def step_speech(self, index: int) -> str:
        return BoardStep(self.steps[index].title, self.effective_rows(index, speech=True)).speech(
            self.dialogue
        )

    @property
    def spoken_script(self) -> str:
        # Keep the saved-lesson transcript stable. Legacy whole-step rendering
        # coalesces rows; the opt-in measured renderer keeps each saved row ID.
        return "\n".join(
            f"[{row.speaker}] {row.text}" if self.dialogue else row.text
            for index in range(len(self.steps))
            for row in self.effective_rows(index, speech=True)
        )

    @property
    def characters(self) -> int:
        return sum(
            len(row.text)
            for index in range(len(self.steps))
            for row in self.effective_rows(index, speech=True)
        )

    @property
    def speakers(self) -> set[int]:
        return {row.speaker for step in self.steps for row in step.rows}

    def manifest(self) -> dict:
        # Explicit fields preserve every legacy schema-1 payload/fingerprint.
        payload = {
            "schema": 1,
            "script": self.script,
            "title": self.title,
            "dialogue": self.dialogue,
            "steps": [asdict(step) for step in self.steps],
        }
        payload = json.loads(json.dumps(payload, ensure_ascii=True))
        if self.visuals is not None:
            source = {**payload, "fingerprint": _fingerprint(payload)}
            plan = VisualPlan.from_data(self.visuals.to_data(), source)
            payload = {**payload, "schema": 2, "visuals": plan.to_data()}
        return {**payload, "fingerprint": _fingerprint(payload)}


@dataclass(frozen=True)
class WhiteboardResult:
    path: Path
    lesson: Lesson
    appearance: BoardAppearance = BoardAppearance()


@dataclass(frozen=True)
class WhiteboardPage:
    page: HtmlPage
    lesson: Lesson
    appearance: BoardAppearance = BoardAppearance()
    timing: TimingMap | None = None

    @classmethod
    def load(cls, source: Path, *, allow_recordings: bool = False) -> "WhiteboardPage":
        page = HtmlPage.load(source)
        inspector = _ManifestInspector()
        inspector.feed(page.content)
        inspector.close()
        if inspector.recordings and not allow_recordings:
            raise WhiteboardError(
                "هذه سبورة بالصوت بالفعل. اختر نسخة السبورة الأصلية بلا صوت لإعادة التوليد."
            )
        expected_markers = 0 if inspector.recordings else 1
        if len(inspector.manifests) != 1 or page.content.count(AUDIO_MARKER) != expected_markers:
            raise WhiteboardError(
                "هذا ليس ملف سبورة Nova المدعوم. أنشئ السبورة من السكريبت في الخطوة 1، "
                "أو استخدم قسم إضافة الصوت إلى HTML للصفحات الأخرى."
            )
        try:
            manifest = json.loads(inspector.manifests[0])
            if not isinstance(manifest, dict) or (
                type(manifest.get("schema")) is not int or manifest["schema"] not in (1, 2)
            ):
                raise ValueError("Unsupported schema")
            if type(manifest.get("dialogue")) is not bool or not isinstance(
                manifest.get("script"), str
            ):
                raise ValueError("Invalid source")
            if not isinstance(manifest.get("fingerprint"), str):
                raise ValueError("Missing fingerprint")
            for pair_pages in (True, False):
                try:
                    candidate = parse_lesson(
                        manifest["script"], dialogue=manifest["dialogue"], _pair_pages=pair_pages
                    )
                    if manifest["schema"] == 2:
                        plan = VisualPlan.from_data(manifest["visuals"], candidate.manifest())
                        candidate = replace(candidate, visuals=plan)
                    expected = candidate.manifest()
                except (WhiteboardError, SceneError):
                    continue
                if manifest == expected and hmac.compare_digest(
                    manifest["fingerprint"], expected["fingerprint"]
                ):
                    lesson = candidate
                    break
            else:
                raise ValueError("Inconsistent lesson data")
        except (ValueError, TypeError, KeyError, RecursionError) as error:
            raise WhiteboardError(
                "بيانات الدرس ناقصة أو تغيّرت. أعد توليد السبورة من السكريبت في الخطوة 1."
            ) from error
        if (
            lesson.visuals
            and lesson.visuals.to_data()["policy"] == "sacred"
            and inspector.recordings
        ):
            raise WhiteboardError("الصوت في وضع النصوص المقدسة غير مدعوم في هذه النسخة.")
        if len(inspector.styles) > 1:
            raise WhiteboardError("بيانات تخصيص السبورة مكررة؛ استخدم نسخة سليمة من الملف.")
        try:
            appearance = (
                BoardAppearance.from_data(
                    json.loads(inspector.styles[0]), tuple(len(step.rows) for step in lesson.steps)
                )
                if inspector.styles
                else BoardAppearance()
            )
        except (ValueError, TypeError, KeyError, RecursionError) as error:
            raise WhiteboardError(
                "ألوان السبورة أو شخصياتها غير صالحة. أعد حفظ التخصيصات."
            ) from error
        timing = None
        try:
            if len(inspector.timings) > 1 or (inspector.timings and not inspector.recordings):
                raise ValueError("Duplicate timing data, or timings without recordings")
            if inspector.recordings:
                if len(inspector.recording_data) != 1 or inspector.duplicate_audio:
                    raise ValueError("Invalid recording metadata")
                recordings = json.loads(inspector.recording_data[0])
                durations = recordings["durations"]
                if (
                    not isinstance(durations, list)
                    or len(durations) != len(lesson.steps)
                    or any(
                        type(d) not in (int, float) or not math.isfinite(d) or d <= 0
                        for d in durations
                    )
                    or set(inspector.audio_types)
                    != {f"nova-wb-audio-{index}" for index in range(len(lesson.steps))}
                ):
                    raise ValueError("Missing recording data")
                if inspector.timings:
                    timing = TimingMap.from_data(
                        json.loads(inspector.timings[0]),
                        lesson.manifest()["fingerprint"],
                        tuple(tuple(row.speaker for row in step.rows) for step in lesson.steps),
                        durations,
                    )
                    for index, clip in enumerate(timing.steps):
                        mime = "audio/wav" if clip.audio_format == "wav" else "audio/mpeg"
                        if inspector.audio_types[f"nova-wb-audio-{index}"] != mime:
                            raise ValueError("Timing format does not match the recording")
        except (ValueError, TypeError, KeyError, RecursionError) as error:
            raise WhiteboardError(
                "خريطة توقيت السطور أو بيانات الصوت ناقصة أو تغيّرت؛ أعد التوليد من الأصل الصامت."
            ) from error
        return cls(page, lesson, appearance, timing)


class _ManifestInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.manifests: list[str] = []
        self.recordings = False
        self.styles: list[str] = []
        self.timings: list[str] = []
        self.recording_data: list[str] = []
        self.audio_types: dict[str, str | None] = {}
        self.duplicate_audio = False
        self._collecting: str | None = None
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "script":
            return
        attributes = dict(attrs)
        if attributes.get("id") == RECORDINGS_ID:
            self.recordings = True
        identifier = attributes.get("id") or ""
        if identifier.startswith("nova-wb-audio-"):
            if (
                identifier in self.audio_types
                or attributes.get("type") != "application/x-nova-audio"
            ):
                self.duplicate_audio = True
            self.audio_types[identifier] = attributes.get("data-mime")
        if attributes.get("id") in (DATA_ID, STYLE_ID, TIMINGS_ID, RECORDINGS_ID):
            if attributes.get("type") != "application/json":
                raise WhiteboardError("بيانات السبورة ليست بالصيغة المدعومة.")
            self._collecting = attributes["id"]
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._collecting:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._collecting:
            target = {
                DATA_ID: self.manifests,
                STYLE_ID: self.styles,
                TIMINGS_ID: self.timings,
                RECORDINGS_ID: self.recording_data,
            }[self._collecting]
            target.append("".join(self._parts))
            self._collecting = None


def _fingerprint(payload: dict) -> str:
    return data_fingerprint(payload)


def _heading(value: str) -> str:
    if has_voice_markers(value):
        raise WhiteboardError(
            "العناوين لا تحتاج وسوم أصوات. احذف الوسوم من العنوان وضعها في محتوى الخطوة فقط."
        )
    if not value or not any(char.isalnum() for char in value) or len(value) > MAX_TITLE:
        raise WhiteboardError(f"اكتب عنوانًا واضحًا لا يزيد على {MAX_TITLE} حرفًا.")
    return value


def parse_lesson(script: str, *, dialogue: bool = False, _pair_pages: bool = True) -> Lesson:
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
        offset = page_number = 0
        while offset < len(rows):
            end = min(offset + ROWS_PER_STEP, len(rows))
            # Keep an adjacent English phrase and its Arabic counterpart on the
            # same page when they fit. This does not invent or translate pairs.
            if (
                _pair_pages
                and end < len(rows)
                and end - offset > 1
                and text_language(rows[end - 1].text) == "en"
                and text_language(rows[end].text) == "ar"
            ):
                end -= 1
            page_title = name if not page_number else f"{name} · متابعة {page_number + 1}"
            steps.append(BoardStep(page_title, rows[offset:end]))
            offset, page_number = end, page_number + 1
            if len(steps) > MAX_STEPS:
                raise WhiteboardError(f"الدرس أطول من {MAX_STEPS} خطوة. قسّم السكريبت إلى دروس.")
    return Lesson(script, title, dialogue, tuple(steps))


def _safe_json(value: object) -> str:
    return (
        json.dumps(value, ensure_ascii=True, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace("&", "\\u0026")
    )


def whiteboard_html(lesson: Lesson, appearance: BoardAppearance | None = None) -> str:
    appearance = (appearance or BoardAppearance()).validated(
        tuple(len(step.rows) for step in lesson.steps)
    )
    assets = resource_dir() / "assets"
    template = (assets / "whiteboard.html").read_text(encoding="utf-8")
    css = (assets / "whiteboard.css").read_text(encoding="utf-8")
    controller = (
        (assets / "whiteboard-appearance.js").read_text(encoding="utf-8")
        + "\n"
        + (assets / "whiteboard-timing.js").read_text(encoding="utf-8")
        + "\n"
        + (assets / "whiteboard-graph.js").read_text(encoding="utf-8")
        + "\n"
        + (assets / "whiteboard-resources.js").read_text(encoding="utf-8")
        + "\n"
        + (assets / "whiteboard-scenes.js").read_text(encoding="utf-8")
        + "\n"
        + (assets / "whiteboard-output.js").read_text(encoding="utf-8")
        + "\n"
        + (assets / "whiteboard.js").read_text(encoding="utf-8")
    )
    if "</script" in controller.lower() or "</style" in css.lower():
        raise WhiteboardError("ملفات قالب السبورة غير صالحة. استخدم حزمة Nova Voice كاملة.")
    accessible = "".join(
        "<section><h2>"
        + escape(step.title)
        + "</h2>"
        + (
            "<p>" + escape(lesson.visuals.to_data()["steps"][index]["description"]) + "</p>"
            if lesson.visuals
            else ""
        )
        + "".join(
            '<p dir="auto">' + escape(row.text) + "</p>" for row in lesson.effective_rows(index)
        )
        + "</section>"
        for index, step in enumerate(lesson.steps)
    )
    try:
        characters = character_templates(assets)
    except (AppearanceError, OSError, ValueError) as error:
        raise WhiteboardError("مكتبة الشخصيات ناقصة أو غير صالحة. استخدم الحزمة كاملة.") from error
    from .secondary_assets import catalog as secondary_catalog
    from .secondary_assets import credits

    resource_credits = credits(lesson.visuals)
    credit_html = ""
    if resource_credits:
        credit_html = (
            '<section id="wb-secondary-credits" class="resource-credits" '
            'aria-label="مصادر الرسوم الثانوية وتراخيصها">'
            "<h2>مصادر الرسوم الثانوية · نسبة لا تُنطق</h2>"
            "<p>صور ظلية ثابتة من Game-icons؛ ليست مفاصل أو توثيقًا علميًا. "
            "أزيلت الخلفية وعُدّل اللون والمقياس. ستظهر النسبة في الطباعة "
            "وبطاقات نهاية الفيديو أيضًا. الروابط لا تُفتح إلا باختيارك.</p>"
        )
        for credit in resource_credits:
            credit_html += (
                "<article>"
                + "".join(
                    '<p dir="ltr">' + escape(credit[key]) + "</p>"
                    for key in (
                        "title",
                        "attribution",
                        "source",
                        "license",
                        "license_url",
                        "changes",
                    )
                )
                + "</article>"
            )
        credit_html += "</section>"
    values = {
        "TITLE": escape(lesson.title),
        "CSS": css,
        "SCRIPT": controller,
        "DATA": _safe_json(lesson.manifest()),
        "FALLBACK": accessible,
        "RESOURCE_CREDITS": credit_html,
        "RESOURCE_CATALOG": '<script id="nova-secondary-catalog" type="application/json">'
        + _safe_json(secondary_catalog())
        + "</script>",
        "AUDIO": AUDIO_MARKER,
        "CHARACTERS": characters,
        "APPEARANCE": f'<script id="{STYLE_ID}" type="application/json">'
        + _safe_json(appearance.to_data())
        + "</script>",
        "CATALOG": f'<script id="{CATALOG_ID}" type="application/json">'
        + _safe_json(character_catalog())
        + "</script>",
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
    *,
    appearance: BoardAppearance | None = None,
) -> WhiteboardResult:
    cancel = cancel if cancel is not None else Event()
    progress = progress or (lambda _: None)
    check_cancelled(cancel)
    appearance = (appearance or BoardAppearance()).validated(
        tuple(len(step.rows) for step in lesson.steps)
    )
    content = whiteboard_html(lesson, appearance).encode("utf-8")
    progress(50)
    path = _atomic_write(destination, lambda output: output.write(content), cancel)
    progress(100)
    return WhiteboardResult(path, lesson, appearance)


def validate_lesson_cast(
    lesson: Lesson, cast: Mapping[int, DialogueVoice], options: RenderOptions
) -> None:
    if lesson.visuals and lesson.visuals.to_data()["policy"] == "sacred":
        raise VoiceError(
            "وضع النصوص المقدسة يعرض النص المراجع فقط في هذه النسخة. لا "
            "يُستخدم Piper أو Azure كتلاوة أو تجويد معتمدين."
        )
    if lesson.dialogue:
        validate_dialogue_cast(
            [
                DialogueTurn(row.speaker, row.text)
                for index in range(len(lesson.steps))
                for row in lesson.effective_rows(index, speech=True)
            ],
            cast,
            options,
        )
    else:
        if 1 not in cast:
            raise VoiceError("اختر نموذج الراوي قبل توليد صوت السبورة.")
        replace(options, speaker_id=cast[1].speaker_id).validate(cast[1].voice)
        for index in range(len(lesson.steps)):
            validate_spoken_language(lesson.step_speech(index), cast[1].voice.language_family)


def whiteboard_speech_lines(
    lesson: Lesson, index: int, turn_pause_ms: int = 350
) -> tuple[SpeechLine, ...]:
    """One source of truth for actual narration rows, not headings/display text."""
    step = lesson.steps[index]
    return tuple(
        SpeechLine(
            row_index,
            row.text,
            row.speaker,
            turn_pause_ms
            if (
                lesson.dialogue
                and row_index + 1 < len(step.rows)
                and step.rows[row_index + 1].speaker != row.speaker
            )
            else 0,
        )
        for row_index, row in enumerate(lesson.effective_rows(index, speech=True))
    )


def whiteboard_cloud_requests(
    engine: SpeechEngine,
    lesson: Lesson,
    cast: Mapping[int, DialogueVoice],
    options: RenderOptions,
    *,
    turn_pause_ms: int = 350,
) -> tuple[CloudRequest, ...]:
    validate_lesson_cast(lesson, cast, options)
    if not 0 <= turn_pause_ms <= 2000:
        raise WhiteboardError("فاصل الردود يجب أن يكون بين 0 و2000 ملّي ثانية.")
    return tuple(
        request
        for index in range(len(lesson.steps))
        for request in engine.line_cloud_requests(
            whiteboard_speech_lines(lesson, index, turn_pause_ms), cast, options
        )
    )


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
    if board.lesson.visuals and not callable(getattr(engine, "render_lines", None)):
        raise WhiteboardError(
            "المشاهد المعتمدة تحتاج محرك قياس توقيت السطور. استخدم نسخة Nova كاملة حديثة."
        )
    if audio_format not in ("mp3", "wav"):
        raise WhiteboardError("اختر MP3 أو WAV للصوت المضمّن في السبورة.")
    if not 0 <= turn_pause_ms <= 2000:
        raise WhiteboardError("فاصل الردود يجب أن يكون بين 0 و2000 ملّي ثانية.")
    clips: list[tuple[Path, float, int]] = []
    measured: list[ClipTiming] = []
    preflight = getattr(engine, "preflight_cloud", None)
    if callable(preflight):
        preflight(
            whiteboard_cloud_requests(
                engine, board.lesson, cast, options, turn_pause_ms=turn_pause_ms
            ),
            complete=True,
        )
    completed = 0
    audio_bytes = 0
    total = board.lesson.characters
    with tempfile.TemporaryDirectory(prefix="nova-whiteboard-speech-") as folder:
        for index, step in enumerate(board.lesson.steps):
            check_cancelled(cancel)
            text = board.lesson.step_speech(index)
            speech_rows = board.lesson.effective_rows(index, speech=True)
            weight = sum(len(row.text) for row in speech_rows)

            def speech_progress(value: int, completed=completed, weight=weight) -> None:
                if value < 0:
                    progress(-1 if not completed else round(85 * completed / total))
                else:
                    progress(min(85, round(85 * (completed + weight * value / 100) / total)))

            clip = Path(folder) / f"step-{index}.{audio_format}"
            render_lines = getattr(engine, "render_lines", None)
            if callable(render_lines):
                # Stable manifest-row IDs are attached before any TTS splitting.
                # Do not create a separate file or artificial pause per row.
                lines = whiteboard_speech_lines(board.lesson, index, turn_pause_ms)
                result = render_lines(lines, cast, clip, options, cancel, speech_progress)
                if not isinstance(result.timing, ClipTiming):
                    raise WhiteboardError("لم يُرجع المحرك قياسًا فعليًا لسطور الخطوة.")
                timing = ClipTiming.from_data(
                    result.timing.to_data(), tuple(row.speaker for row in step.rows)
                )
                if timing.audio_format != audio_format:
                    raise WhiteboardError("صيغة خريطة التوقيت لا تطابق الصوت.")
                measured.append(timing)
            elif board.lesson.dialogue:
                # Compatibility with older injected engines: do not fabricate
                # line measurements from their whole-clip duration.
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
        # A saved v0.4/v0.5 board contains its old controller. Re-export only
        # supported Nova lessons with the trusted current template and validated
        # saved appearance; never execute imported JavaScript or change the source.
        prefix, suffix = whiteboard_html(board.lesson, board.appearance).split(AUDIO_MARKER)
        durations = [duration for _, duration, _ in clips]
        timing_data = None
        if measured:
            if len(measured) != len(board.lesson.steps):
                raise WhiteboardError("خريطة توقيت الخطوات غير مكتملة.")
            timing_map = TimingMap(board.lesson.manifest()["fingerprint"], tuple(measured))
            timing_data = timing_map.to_data()
            TimingMap.from_data(
                timing_data,
                board.lesson.manifest()["fingerprint"],
                tuple(tuple(row.speaker for row in step.rows) for step in board.lesson.steps),
                durations,
            )
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
            if timing_data is not None:
                output.write(
                    (
                        f'<script id="{TIMINGS_ID}" type="application/json">'
                        + _safe_json(timing_data)
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


def render_whiteboard_with_audio(
    engine: SpeechEngine,
    lesson: Lesson,
    cast: Mapping[int, DialogueVoice],
    destination: Path,
    options: RenderOptions,
    cancel: Event | None = None,
    progress: Callable[[int], None] | None = None,
    *,
    turn_pause_ms: int = 350,
    audio_format: str = "mp3",
    appearance: BoardAppearance | None = None,
) -> HtmlAudioResult:
    """One user output, using the SAME saved-lesson/measured-audio pipeline.

    The silent HTML is private staging, not an extra user save or a UI source.
    It is removed on success, failure and cancellation. Audio remains one
    sequential encoder/file per step; only the final atomic HTML is published.
    The caller snapshots the current editor lesson/appearance before the worker.
    """
    cancel = cancel if cancel is not None else Event()
    progress = progress or (lambda _: None)
    check_cancelled(cancel)
    validate_lesson_cast(lesson, cast, options)
    with tempfile.TemporaryDirectory(prefix="nova-whiteboard-combined-") as folder:
        source = Path(folder) / "lesson.html"
        save_whiteboard(
            lesson,
            source,
            cancel,
            lambda value: progress(round(5 * value / 100)),
            appearance=appearance,
        )
        check_cancelled(cancel)
        return render_whiteboard_audio(
            engine,
            source,
            cast,
            destination,
            options,
            cancel,
            lambda value: progress(-1 if value < 0 else 5 + round(95 * value / 100)),
            turn_pause_ms=turn_pause_ms,
            audio_format=audio_format,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="سكريبت TXT إلى سبورة HTML محلية بلا صوت.")
    parser.add_argument("script", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--dialogue", action="store_true", help="تفعيل وسوم [1]/[2]")
    parser.add_argument("--scene-plan", type=Path, help="خطة JSON محلية مرتبطة بالسكريبت")
    parser.add_argument(
        "--approve-scenes", action="store_true", help="تأكيد مراجعة واعتماد هذه الخطة"
    )
    args = parser.parse_args()
    if args.approve_scenes and not args.scene_plan:
        parser.error("--approve-scenes يحتاج --scene-plan")
    try:
        lesson = parse_lesson(read_script(args.script), dialogue=args.dialogue)
        if args.scene_plan:
            plan = VisualPlan.load(args.scene_plan, lesson.manifest())
            if not args.approve_scenes:
                print(review_text(plan, lesson.manifest()))
                parser.exit(
                    2, "راجع الخطة والمعاينة ثم أضف --approve-scenes إن اعتمدتها؛ لم يُكتب HTML.\n"
                )
            lesson = replace(lesson, visuals=plan)
        validate_destination(args.script, args.output)
        if args.scene_plan:
            validate_destination(args.scene_plan, args.output)
        result = save_whiteboard(lesson, args.output)
    except (OSError, UnicodeError, ScriptError, HtmlExportError) as error:
        parser.exit(1, f"{error}\n")
    print(f"Saved {len(lesson.steps)} steps: {result.path}")


if __name__ == "__main__":
    main()
