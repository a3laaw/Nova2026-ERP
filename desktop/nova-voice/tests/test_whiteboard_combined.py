"""One-click export reuses the saved-lesson pipeline and publishes only final HTML."""

from dataclasses import replace
from pathlib import Path
from threading import Event

import pytest

from nova_voice.appearance import AppearanceError, BoardAppearance, RowColor
from nova_voice.engine import AudioError, DialogueVoice, RenderOptions, SpeechEngine
from nova_voice.html_export import HtmlExportError
from nova_voice.voices import Cancelled, VoiceError
from nova_voice.whiteboard import (
    AUDIO_MARKER,
    WhiteboardError,
    WhiteboardPage,
    parse_lesson,
    render_whiteboard_audio,
    render_whiteboard_with_audio,
    save_whiteboard,
)


@pytest.fixture
def lesson():
    return parse_lesson(
        "# Together\n## First\n[1] مرحبًا.[/1][2] Hello.[/2]\n## Second\n[2] Goodbye.[/2]",
        dialogue=True,
    )


@pytest.fixture
def appearance():
    return BoardAppearance(
        first_character="adam",
        second_character="nour",
        layout="columns",
        row_colors=(RowColor(0, 1, "#475569"),),
    )


@pytest.fixture
def staging(tmp_path, monkeypatch):
    import tempfile

    original = tempfile.TemporaryDirectory
    folders = []
    scratch = tmp_path / "private-staging"
    scratch.mkdir()

    def directory(*args, **kwargs):
        if kwargs.get("prefix", "").startswith("nova-whiteboard-"):
            kwargs["dir"] = scratch
            result = original(*args, **kwargs)
            folders.append(Path(result.name))
            return result
        return original(*args, **kwargs)

    monkeypatch.setattr("nova_voice.whiteboard.tempfile.TemporaryDirectory", directory)
    yield folders
    assert all(not path.exists() for path in folders)
    assert not list(scratch.iterdir())
    assert not list(tmp_path.glob(".nova-whiteboard-*"))


@pytest.mark.parametrize("audio_format", ["wav", "mp3"])
def test_combined_has_one_output_with_text_audio_appearance_and_actual_timing(
    tmp_path, lesson, appearance, bilingual_cast, staging, monkeypatch, audio_format
):
    import nova_voice.whiteboard as board_module

    source_pages = []
    original = board_module.render_whiteboard_audio

    def render(engine, source, *args, **kwargs):
        saved = WhiteboardPage.load(source)
        assert saved.lesson == lesson and saved.appearance == appearance
        assert AUDIO_MARKER in saved.page.content and saved.timing is None
        source_pages.append(saved.page.source)
        return original(engine, source, *args, **kwargs)

    monkeypatch.setattr(board_module, "render_whiteboard_audio", render)
    output = tmp_path / "complete.html"
    progress = []
    result = render_whiteboard_with_audio(
        SpeechEngine(),
        lesson,
        bilingual_cast,
        output,
        RenderOptions(),
        progress=progress.append,
        audio_format=audio_format,
        appearance=appearance,
    )
    page = WhiteboardPage.load(output, allow_recordings=True)
    assert result.path == output
    assert result.characters == lesson.characters and result.duration_seconds > 0
    assert result.audio_bytes > 0
    assert page.lesson == lesson and page.appearance == appearance
    assert page.timing is not None and len(page.timing.steps) == len(lesson.steps)
    assert all(step.audio_format == audio_format for step in page.timing.steps)
    assert len(source_pages) == 1 and all(not path.exists() for path in source_pages)
    assert len(staging) == 2  # Private silent HTML + existing per-step audio staging.
    assert list(tmp_path.glob("*.html")) == [output]
    content = output.read_text(encoding="utf-8-sig")
    assert content.count('type="application/x-nova-audio"') == len(lesson.steps)
    assert all(str(path) not in content for path in source_pages + staging)
    assert all(
        str(assignment.voice.model_path) not in content for assignment in bilingual_cast.values()
    )
    assert progress[-1] == 100 and -1 in progress
    numbered = [value for value in progress if value >= 0]
    assert numbered == sorted(numbered) and all(value <= 100 for value in numbered)


@pytest.mark.parametrize("audio_format", ["wav", "mp3"])
def test_one_click_and_two_step_results_have_identical_contents(
    tmp_path, lesson, appearance, bilingual_cast, staging, audio_format
):
    source = tmp_path / "silent.html"
    save_whiteboard(lesson, source, appearance=appearance)
    original = source.read_bytes()
    expected = tmp_path / "two-step.html"
    actual = tmp_path / "one-click.html"
    options = RenderOptions(speed=1.15, pause_ms=200)
    render_whiteboard_audio(
        SpeechEngine(),
        source,
        bilingual_cast,
        expected,
        options,
        turn_pause_ms=425,
        audio_format=audio_format,
    )
    render_whiteboard_with_audio(
        SpeechEngine(),
        lesson,
        bilingual_cast,
        actual,
        options,
        turn_pause_ms=425,
        audio_format=audio_format,
        appearance=appearance,
    )
    assert actual.read_bytes() == expected.read_bytes()
    assert source.read_bytes() == original


@pytest.mark.parametrize("threshold", [2, 5, 15, 90])
def test_cancel_at_each_stage_keeps_old_output_and_removes_staging(
    tmp_path, lesson, appearance, bilingual_cast, staging, threshold
):
    output = tmp_path / "previous.html"
    output.write_bytes(b"old complete HTML")
    cancel = Event()
    with pytest.raises(Cancelled):
        render_whiteboard_with_audio(
            SpeechEngine(),
            lesson,
            bilingual_cast,
            output,
            RenderOptions(),
            cancel,
            lambda value: cancel.set() if value >= threshold else None,
            appearance=appearance,
            audio_format="wav",
        )
    assert output.read_bytes() == b"old complete HTML"


def test_pre_cancelled_job_creates_no_staging_or_audio(
    tmp_path, lesson, bilingual_cast, staging, monkeypatch
):
    cancel = Event()
    cancel.set()
    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", lambda _: pytest.fail("Cancelled job loaded a voice"))
    with pytest.raises(Cancelled):
        render_whiteboard_with_audio(
            engine,
            lesson,
            bilingual_cast,
            tmp_path / "never.html",
            RenderOptions(),
            cancel,
        )
    assert staging == [] and not (tmp_path / "never.html").exists()


@pytest.mark.parametrize("problem", ["missing", "language", "same-model", "speed"])
def test_cast_and_options_fail_before_staging_or_model_loading(
    tmp_path, lesson, bilingual_cast, staging, monkeypatch, problem
):
    cast, options = dict(bilingual_cast), RenderOptions()
    if problem == "missing":
        del cast[2]
    elif problem == "language":
        cast[1] = cast[2]
        cast[2] = bilingual_cast[1]
    elif problem == "same-model":
        cast[2] = cast[1]
    else:
        options = RenderOptions(speed=2)
    output = tmp_path / "previous.html"
    output.write_bytes(b"old complete HTML")
    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", lambda _: pytest.fail("Invalid input loaded a voice"))
    with pytest.raises((VoiceError, AudioError)):
        render_whiteboard_with_audio(engine, lesson, cast, output, options)
    assert output.read_bytes() == b"old complete HTML" and staging == []


@pytest.mark.parametrize("problem", ["format", "pause", "appearance", "extension", "html-limit"])
def test_other_invalid_inputs_do_not_load_a_model_or_publish_a_partial_output(
    tmp_path, lesson, appearance, bilingual_cast, staging, monkeypatch, problem
):
    kwargs = {"audio_format": "wav", "appearance": appearance}
    output = tmp_path / ("previous.txt" if problem == "extension" else "previous.html")
    output.write_bytes(b"old complete HTML")
    if problem == "format":
        kwargs["audio_format"] = "ogg"
    elif problem == "pause":
        kwargs["turn_pause_ms"] = 2001
    elif problem == "appearance":
        kwargs["appearance"] = replace(appearance, first_color="</script>")
    elif problem == "html-limit":
        monkeypatch.setattr("nova_voice.whiteboard.MAX_HTML_BYTES", 10)
    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", lambda _: pytest.fail("Invalid input loaded a voice"))
    with pytest.raises((WhiteboardError, HtmlExportError, AppearanceError)):
        render_whiteboard_with_audio(
            engine, lesson, bilingual_cast, output, RenderOptions(), **kwargs
        )
    assert output.read_bytes() == b"old complete HTML"


def test_second_step_failure_does_not_replace_output_and_cleans_finished_clips(
    tmp_path, lesson, bilingual_cast, staging, monkeypatch
):
    engine = SpeechEngine()
    original = engine.render_lines
    completed = []

    def render(lines, cast, path, *args, **kwargs):
        if completed:
            assert completed[0].exists()
            raise AudioError("second step failed")
        result = original(lines, cast, path, *args, **kwargs)
        completed.append(result.path)
        return result

    monkeypatch.setattr(engine, "render_lines", render)
    output = tmp_path / "previous.html"
    output.write_bytes(b"old complete HTML")
    with pytest.raises(AudioError, match="second step"):
        render_whiteboard_with_audio(
            engine,
            lesson,
            bilingual_cast,
            output,
            RenderOptions(),
            audio_format="wav",
        )
    assert output.read_bytes() == b"old complete HTML"
    assert completed and all(not path.exists() for path in completed)


def test_audio_limit_is_still_enforced_for_the_combined_export(
    tmp_path, lesson, bilingual_cast, staging, monkeypatch
):
    monkeypatch.setattr("nova_voice.whiteboard.MAX_AUDIO_BYTES", 100)
    output = tmp_path / "previous.html"
    output.write_bytes(b"old complete HTML")
    with pytest.raises(WhiteboardError, match="256"):
        render_whiteboard_with_audio(
            SpeechEngine(),
            lesson,
            bilingual_cast,
            output,
            RenderOptions(),
            audio_format="wav",
        )
    assert output.read_bytes() == b"old complete HTML"


def test_dialogue_with_only_the_second_role_needs_only_that_voice(tmp_path, voice_spec, staging):
    lesson = parse_lesson("# One role\n## Step\n[2] Hello.[/2]", dialogue=True)
    output = tmp_path / "second-role.html"
    render_whiteboard_with_audio(
        SpeechEngine(),
        lesson,
        {2: DialogueVoice(voice_spec)},
        output,
        RenderOptions(),
        audio_format="wav",
    )
    loaded = WhiteboardPage.load(output, allow_recordings=True)
    assert loaded.lesson.speakers == {2}
    assert loaded.timing.steps[0].lines[0].speaker == 2
