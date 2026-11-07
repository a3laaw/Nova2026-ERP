import base64
import re
import wave
from pathlib import Path
from threading import Event

import pytest

from nova_voice.engine import DialogueVoice, RenderOptions, RenderResult, SpeechEngine
from nova_voice.html_export import HtmlExportError
from nova_voice.text import ScriptError
from nova_voice.voices import Cancelled, VoiceError
from nova_voice.whiteboard import (
    AUDIO_MARKER,
    DATA_ID,
    RECORDINGS_ID,
    ROW_CHARACTERS,
    ROWS_PER_STEP,
    WHITEBOARD_EXAMPLE,
    WhiteboardError,
    WhiteboardPage,
    parse_lesson,
    render_whiteboard_audio,
    save_whiteboard,
    validate_lesson_cast,
    whiteboard_html,
)


@pytest.fixture
def saved_board(tmp_path):
    lesson = parse_lesson("# My lesson\n## First\nHello there.\n## Second\nGoodbye.")
    path = tmp_path / "lesson.html"
    save_whiteboard(lesson, path)
    return path, lesson


class FakeEngine:
    def __init__(self, cancel=None, callback=None):
        self.calls = []
        self.cancel = cancel
        self.callback = callback

    def _write(self, text, destination, options, progress, dialogue, **kwargs):
        self.calls.append((text, options, dialogue, kwargs))
        with wave.open(str(destination), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(22050)
            audio.writeframes(bytes([len(self.calls)]) * 4410)
        progress(-1)
        progress(100)
        if self.callback:
            self.callback()
        if self.cancel:
            self.cancel.set()
        return RenderResult(destination, 0.1, len(text))

    def render(self, text, voice, destination, options, cancel, progress):
        return self._write(text, destination, options, progress, False)

    def render_dialogue(self, text, cast, destination, options, cancel, progress, **kwargs):
        return self._write(text, destination, options, progress, True, **kwargs)


def test_plain_paragraphs_become_steps_without_a_voice_model():
    lesson = parse_lesson("مرحبًا بكم.\nأهلًا وسهلًا.\n\nHello again.")
    assert lesson.title == "درس جديد"
    assert len(lesson.steps) == 2
    assert len(lesson.steps[0].rows) == 2
    assert lesson.speakers == {1}
    assert lesson.spoken_script == "مرحبًا بكم.\nأهلًا وسهلًا.\nHello again."


def test_structural_titles_and_bullets_are_not_spoken():
    lesson = parse_lesson("# عنوان الدرس\n\n## عنوان الخطوة\n- مرحبًا.\n* Hello.")
    assert lesson.title == "عنوان الدرس"
    assert lesson.steps[0].title == "عنوان الخطوة"
    assert lesson.spoken_script == "مرحبًا.\nHello."
    assert "عنوان" not in lesson.spoken_script


def test_bilingual_example_keeps_all_roles_and_seven_steps():
    lesson = parse_lesson(WHITEBOARD_EXAMPLE, dialogue=True)
    assert len(lesson.steps) == 7
    assert lesson.speakers == {1, 2}
    assert "[1]" in lesson.spoken_script and "[2]" in lesson.spoken_script
    assert lesson.steps[1].rows[0].text == "Hello!"
    assert lesson.steps[1].rows[1].text == "مرحبًا!"
    assert lesson.steps[1].rows[0].speaker == 2


@pytest.mark.parametrize("script", ["", "---", "# Title", "## Empty", "## One\n## Two\nHello."])
def test_empty_lessons_or_steps_are_rejected(script):
    with pytest.raises(ScriptError):
        parse_lesson(script)


@pytest.mark.parametrize("script", ["#", "##", "### No\nHello", "# A\n# B\nHi", "Hi\n# Late"])
def test_invalid_heading_structure_is_rejected(script):
    with pytest.raises(WhiteboardError):
        parse_lesson(script)


def test_overlong_title_and_too_many_steps_are_rejected(monkeypatch):
    with pytest.raises(WhiteboardError):
        parse_lesson("# " + "A" * 121 + "\nHello.")
    monkeypatch.setattr("nova_voice.whiteboard.MAX_STEPS", 2)
    with pytest.raises(WhiteboardError, match="خطوة"):
        parse_lesson("one\n\ntwo\n\nthree")


def test_tags_require_dialogue_and_dialogue_content_requires_tags():
    with pytest.raises(WhiteboardError, match="حوار"):
        parse_lesson("# Lesson\n## Step\n[1] Hello.")
    with pytest.raises(ScriptError, match="وسم"):
        parse_lesson("# Lesson\n## Step\n[3] Hello.", dialogue=True)
    with pytest.raises(ScriptError, match="صاحب"):
        parse_lesson("# Lesson\n## Step\nHello.", dialogue=True)


def test_long_rows_and_scenes_paginate_without_losing_spoken_words():
    text = " ".join(f"word{i}" for i in range(500))
    lesson = parse_lesson("# Title\n## Long scene\n" + text)
    assert len(lesson.steps) > 1
    assert all(len(step.rows) <= ROWS_PER_STEP for step in lesson.steps)
    assert all(len(row.text) <= ROW_CHARACTERS for step in lesson.steps for row in step.rows)
    assert "متابعة" in lesson.steps[1].title
    assert " ".join(lesson.spoken_script.split()) == text


def test_unbroken_unicode_and_dialogue_continuations_are_preserved():
    text = "أ" * 600
    lesson = parse_lesson("## خطوة\n[2] " + text, dialogue=True)
    assert "".join(row.text for step in lesson.steps for row in step.rows) == text
    assert all(row.speaker == 2 for step in lesson.steps for row in step.rows)


def test_html_is_self_contained_bom_encoded_and_round_trips(saved_board):
    source, lesson = saved_board
    assert source.read_bytes().startswith(b"\xef\xbb\xbf")
    board = WhiteboardPage.load(source)
    assert board.lesson == lesson
    assert board.page.source == source.resolve()
    content = source.read_text(encoding="utf-8-sig")
    assert content.count(AUDIO_MARKER) == 1
    assert "<script src=" not in content and "<link " not in content
    assert "speechSynthesis" not in content
    assert RECORDINGS_ID not in re.findall(r'<script id="([^"]+)"', content)


def test_user_html_and_script_strings_are_text_never_executed(tmp_path):
    attack = '</script><img src=x onerror="window.pwned=1">'
    lesson = parse_lesson(f"# Safe {attack}\n## Text\n{attack}")
    path = tmp_path / "safe.html"
    save_whiteboard(lesson, path)
    raw = path.read_text(encoding="utf-8-sig")
    assert "<img src=x" not in raw
    assert "\\u003c/script>" in raw
    assert WhiteboardPage.load(path).lesson == lesson


def test_duplicate_or_modified_manifest_is_refused(saved_board):
    source, _ = saved_board
    original = source.read_text(encoding="utf-8-sig")
    source.write_text(original.replace('"title":"My lesson"', '"title":"Other lesson"'))
    with pytest.raises(WhiteboardError, match="تغيّرت"):
        WhiteboardPage.load(source)
    source.write_text(
        original.replace(
            AUDIO_MARKER,
            f'<script id="{DATA_ID}" type="application/json">{{}}</script>' + AUDIO_MARKER,
        )
    )
    with pytest.raises(WhiteboardError):
        WhiteboardPage.load(source)


def test_runtime_structure_and_unsupported_html_are_refused(saved_board, tmp_path):
    source, _ = saved_board
    original = source.read_text(encoding="utf-8-sig")
    source.write_text(original.replace(AUDIO_MARKER, ""))
    with pytest.raises(WhiteboardError):
        WhiteboardPage.load(source)
    foreign = tmp_path / "foreign.html"
    foreign.write_text("<body>Not a generated Nova lesson</body>")
    with pytest.raises(WhiteboardError, match="الخطوة 1"):
        WhiteboardPage.load(foreign)


def test_corrupt_json_and_boolean_schema_are_refused(saved_board):
    source, _ = saved_board
    original = source.read_text(encoding="utf-8-sig")
    for changed in (
        original.replace('"schema":1', '"schema":true'),
        original.replace('"schema":1', "NOT JSON"),
    ):
        source.write_text(changed)
        with pytest.raises(WhiteboardError):
            WhiteboardPage.load(source)


def test_csp_is_not_weakened(saved_board):
    source, _ = saved_board
    source.write_text(
        source.read_text(encoding="utf-8-sig").replace(
            "<head>", '<head><meta http-equiv="Content-Security-Policy" content="default-src self">'
        )
    )
    with pytest.raises(HtmlExportError, match="CSP"):
        WhiteboardPage.load(source)


def test_cancelled_silent_export_keeps_previous_file(tmp_path):
    output = tmp_path / "old.html"
    output.write_bytes(b"previous file")
    event = Event()
    with pytest.raises(Cancelled):
        save_whiteboard(parse_lesson("Hello."), output, event, lambda _: event.set())
    assert output.read_bytes() == b"previous file"
    assert not list(tmp_path.glob(".nova-whiteboard-*"))


def test_silent_export_rejects_wrong_extension(tmp_path):
    with pytest.raises(WhiteboardError):
        save_whiteboard(parse_lesson("Hello."), tmp_path / "wrong.txt")


def test_cast_validation_covers_the_whole_lesson_not_just_one_step(bilingual_cast):
    lesson = parse_lesson("## One\n[1] مرحبًا.\n## Two\n[2] Hello.", dialogue=True)
    with pytest.raises(VoiceError):
        validate_lesson_cast(lesson, {1: bilingual_cast[1]}, RenderOptions())
    with pytest.raises(VoiceError, match="نفسيهما"):
        validate_lesson_cast(lesson, {1: bilingual_cast[1], 2: bilingual_cast[1]}, RenderOptions())
    validate_lesson_cast(lesson, bilingual_cast, RenderOptions())


def test_step_audio_uses_saved_script_and_correct_speaker_id(saved_board, voice_spec, tmp_path):
    source, lesson = saved_board
    original = source.read_bytes()
    output = tmp_path / "narrated.html"
    engine = FakeEngine()
    values = []
    result = render_whiteboard_audio(
        engine,
        source,
        {1: DialogueVoice(voice_spec)},
        output,
        RenderOptions(speaker_id=999),
        progress=values.append,
        audio_format="wav",
    )
    assert [call[0] for call in engine.calls] == ["Hello there.", "Goodbye."]
    assert all(call[1].speaker_id == 0 for call in engine.calls)
    assert result.characters == lesson.characters
    assert result.duration_seconds == pytest.approx(0.2)
    assert values[-1] == 100
    assert source.read_bytes() == original
    html = output.read_text(encoding="utf-8-sig")
    payloads = re.findall(
        r'type="application/x-nova-audio" data-mime="audio/wav">([^<]+)</script>', html
    )
    assert len(payloads) == 2
    assert all(base64.b64decode(payload).startswith(b"RIFF") for payload in payloads)
    assert AUDIO_MARKER not in html
    assert result.audio_bytes == sum(len(base64.b64decode(payload)) for payload in payloads)
    with pytest.raises(WhiteboardError, match="بالفعل"):
        WhiteboardPage.load(output)


def test_dialogue_audio_preserves_order_and_omits_headers(tmp_path, bilingual_cast):
    source = tmp_path / "lesson.html"
    save_whiteboard(
        parse_lesson(
            "# Title\n## First\n[1] أهلًا.\n[2] Hello.\n## Second\n[2] Goodbye.", dialogue=True
        ),
        source,
    )
    engine = FakeEngine()
    render_whiteboard_audio(
        engine,
        source,
        bilingual_cast,
        tmp_path / "out.html",
        RenderOptions(),
        turn_pause_ms=600,
        audio_format="mp3",
    )
    assert [call[0] for call in engine.calls] == ["[1] أهلًا.\n[2] Hello.", "[2] Goodbye."]
    assert all(call[2] and call[3]["turn_pause_ms"] == 600 for call in engine.calls)


def test_original_overwrite_and_invalid_options_do_not_call_engine(
    saved_board, voice_spec, tmp_path
):
    source, _ = saved_board
    cast = {1: DialogueVoice(voice_spec)}
    engine = FakeEngine()
    with pytest.raises(HtmlExportError):
        render_whiteboard_audio(engine, source, cast, source, RenderOptions())
    for kwargs in ({"audio_format": "ogg"}, {"turn_pause_ms": -1}):
        with pytest.raises(WhiteboardError):
            render_whiteboard_audio(
                engine, source, cast, tmp_path / "out.html", RenderOptions(), **kwargs
            )
    with pytest.raises(VoiceError):
        render_whiteboard_audio(engine, source, {}, tmp_path / "out.html", RenderOptions())
    assert not engine.calls


def test_cancellation_during_synthesis_preserves_destination(saved_board, voice_spec, tmp_path):
    source, _ = saved_board
    event = Event()
    engine = FakeEngine(cancel=event)
    output = tmp_path / "out.html"
    output.write_bytes(b"old result")
    with pytest.raises(Cancelled):
        render_whiteboard_audio(
            engine, source, {1: DialogueVoice(voice_spec)}, output, RenderOptions(), event
        )
    assert len(engine.calls) == 1
    assert output.read_bytes() == b"old result"


def test_cancellation_during_embedding_is_atomic(saved_board, voice_spec, tmp_path):
    source, _ = saved_board
    event = Event()
    output = tmp_path / "out.html"
    output.write_bytes(b"old result")
    with pytest.raises(Cancelled):
        render_whiteboard_audio(
            FakeEngine(),
            source,
            {1: DialogueVoice(voice_spec)},
            output,
            RenderOptions(),
            event,
            lambda value: event.set() if value > 85 else None,
        )
    assert output.read_bytes() == b"old result"
    assert not list(tmp_path.glob(".nova-whiteboard-*"))


def test_total_audio_limit_is_enforced_across_all_steps(
    saved_board, voice_spec, tmp_path, monkeypatch
):
    source, _ = saved_board
    monkeypatch.setattr("nova_voice.whiteboard.MAX_AUDIO_BYTES", 6000)
    output = tmp_path / "out.html"
    with pytest.raises(WhiteboardError, match="256"):
        render_whiteboard_audio(
            FakeEngine(), source, {1: DialogueVoice(voice_spec)}, output, RenderOptions()
        )
    assert not output.exists()


def test_pre_cancelled_job_does_not_read_or_synthesize(tmp_path):
    event = Event()
    event.set()
    with pytest.raises(Cancelled):
        render_whiteboard_audio(
            None, tmp_path / "missing.html", {}, tmp_path / "out.html", RenderOptions(), event
        )


def test_real_piper_fixture_can_generate_two_step_embedded_wav(saved_board, voice_spec, tmp_path):
    source, lesson = saved_board
    result = render_whiteboard_audio(
        SpeechEngine(),
        source,
        {1: DialogueVoice(voice_spec)},
        tmp_path / "real.html",
        RenderOptions(),
        audio_format="wav",
    )
    assert result.characters == lesson.characters
    assert result.duration_seconds > 0
    assert result.audio_bytes > 88


def test_template_resource_guard_and_one_pass_substitution(monkeypatch):
    lesson = parse_lesson("# @@NOVA_CSS@@\nHello.")
    html = whiteboard_html(lesson)
    assert "<title>@@NOVA_CSS@@</title>" in html
    monkeypatch.setattr("nova_voice.whiteboard.MAX_HTML_BYTES", 10)
    with pytest.raises(WhiteboardError):
        whiteboard_html(lesson)


def test_example_script_matches_runtime_example():
    path = Path(__file__).parents[1] / "examples" / "greetings-lesson.txt"
    assert path.read_text(encoding="utf-8") == WHITEBOARD_EXAMPLE


def test_bundled_html_example_is_generated_by_the_current_template():
    path = Path(__file__).parents[1] / "examples" / "greetings-whiteboard.html"
    assert path.read_text(encoding="utf-8-sig") == whiteboard_html(
        parse_lesson(WHITEBOARD_EXAMPLE, dialogue=True)
    )


def test_english_dialogue_example_has_both_roles_and_no_headings_in_speech():
    path = Path(__file__).parents[1] / "examples" / "english-whiteboard-dialogue.txt"
    lesson = parse_lesson(path.read_text(encoding="utf-8"), dialogue=True)
    assert lesson.speakers == {1, 2}
    assert len(lesson.steps) == 3
    assert "##" not in lesson.spoken_script
