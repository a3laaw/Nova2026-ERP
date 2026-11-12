"""Inline voice tags must not reach rendered board text or the speech backend."""

from pathlib import Path
from types import SimpleNamespace

import pytest

from nova_voice.engine import RenderOptions, SpeechEngine
from nova_voice.text import ScriptError
from nova_voice.whiteboard import (
    WhiteboardError,
    WhiteboardPage,
    parse_lesson,
    render_whiteboard_audio,
    save_whiteboard,
)

EXAMPLE = Path(__file__).resolve().parents[1] / "examples" / "greetings-inline-dialogue.txt"
EXPECTED = [
    (1, "أهلًا بكم! اليوم نتعلّم كيف نُحيّي الآخرين ونُقدّم أنفسنا. الدرس الأول."),
    (2, "Greetings and Introductions."),
    (1, "التحيات والتعارف."),
    (2, "Hello!"),
    (1, "مرحبًا!"),
    (2, "Good morning!"),
    (1, "صباح الخير!"),
]


def test_corrected_greetings_example_displays_all_words_without_speaker_markup():
    lesson = parse_lesson(EXAMPLE.read_text(encoding="utf-8"), dialogue=True)
    assert lesson.title == "التحيات والتعارف"
    assert len(lesson.steps) == 2
    assert [(row.speaker, row.text) for step in lesson.steps for row in step.rows] == EXPECTED
    assert lesson.characters == sum(len(text) for _, text in EXPECTED)
    assert all(
        "[" not in row.text and "]" not in row.text for step in lesson.steps for row in step.rows
    )


@pytest.mark.parametrize(
    "body",
    [
        "An introduction [1] مرحبًا.",
        "An introduction [/1] مرحبًا.",
        "An introduction [2] Hello.[/2]",
        "[1] مرحبًا.[/1]",
        "[/1] مرحبًا.",
    ],
)
def test_single_voice_board_rejects_inline_opening_and_closing_tags(body):
    with pytest.raises(WhiteboardError, match="حوار"):
        parse_lesson("# Lesson\n## Step\n" + body)


@pytest.mark.parametrize("title", ["# [1] Lesson[/1]", "## Intro [2] Lesson[/2]"])
def test_voice_markers_in_titles_are_rejected_instead_of_displayed(title):
    with pytest.raises(WhiteboardError, match="العناوين"):
        parse_lesson(title + "\n[1] Content.", dialogue=True)


def test_inline_saved_lesson_round_trips_without_retyping_and_preserves_its_script(tmp_path):
    lesson = parse_lesson(EXAMPLE.read_text(encoding="utf-8"), dialogue=True)
    output = tmp_path / "silent.html"
    save_whiteboard(lesson, output)
    loaded = WhiteboardPage.load(output)
    assert loaded.lesson == lesson
    assert "[/1]" in loaded.lesson.script  # Saved source, not visible or spoken row text.
    assert [
        (row.speaker, row.text) for step in loaded.lesson.steps for row in step.rows
    ] == EXPECTED


def test_inline_saved_lesson_passes_only_clean_text_to_the_actual_speech_pipeline(
    tmp_path, bilingual_cast, monkeypatch
):
    lesson = parse_lesson(EXAMPLE.read_text(encoding="utf-8"), dialogue=True)
    source = tmp_path / "silent.html"
    destination = tmp_path / "narrated.html"
    save_whiteboard(lesson, source)
    original = source.read_bytes()
    engine = SpeechEngine()
    observed = []

    def load_voice(spec):
        role = 1 if spec == bilingual_cast[1].voice else 2

        def synthesize(text, syn_config):
            observed.append((role, text))
            yield SimpleNamespace(
                sample_rate=spec.sample_rate,
                sample_width=2,
                sample_channels=1,
                audio_int16_bytes=bytes(spec.sample_rate // 10 * 2),
            )

        return SimpleNamespace(
            config=SimpleNamespace(sample_rate=spec.sample_rate, length_scale=1.0),
            synthesize=synthesize,
        )

    monkeypatch.setattr(engine, "_load", load_voice)
    result = render_whiteboard_audio(
        engine,
        source,
        bilingual_cast,
        destination,
        RenderOptions(),
        audio_format="wav",
    )
    assert observed == EXPECTED
    assert result.path == destination
    assert result.characters == sum(len(text) for _, text in EXPECTED)
    assert source.read_bytes() == original
    assert 'id="nova-whiteboard-recordings"' in destination.read_text(encoding="utf-8-sig")


@pytest.mark.parametrize("script", ["[/1]أهلًا.[/1][2] Hello.[/2]", "[1] أهلًا.[/2]"])
def test_invalid_markers_cannot_reach_synthesis_or_overwrite_existing_output(
    script, tmp_path, bilingual_cast, monkeypatch
):
    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", lambda _: pytest.fail("Invalid text reached a model"))
    output = tmp_path / "existing.wav"
    output.write_bytes(b"preserve the previous recording")
    with pytest.raises(ScriptError):
        engine.render_dialogue(script, bilingual_cast, output, RenderOptions())
    assert output.read_bytes() == b"preserve the previous recording"


@pytest.mark.parametrize("script", ["Intro [1] Hello.", "Intro [/1] Hello.", "[1] Hello.[/1]"])
def test_single_voice_synthesis_cannot_speak_inline_voice_tags(
    script, tmp_path, voice_spec, monkeypatch
):
    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", lambda _: pytest.fail("Single mode tried to speak tags"))
    output = tmp_path / "single.wav"
    with pytest.raises(ScriptError, match="حوار"):
        engine.render(script, voice_spec, output, RenderOptions())
    assert not output.exists()


def test_real_piper_fixture_accepts_inline_spans_offline(tmp_path, bilingual_cast):
    """The bundled synthetic models generate silence, not a natural-voice demo."""
    import wave

    script = "[1] مرحبًا.[/1][2] Hello![/2][1] شكرًا.[/1]"
    result = SpeechEngine().render_dialogue(
        script,
        bilingual_cast,
        tmp_path / "inline-real-pipeline.wav",
        RenderOptions(pause_ms=0),
        turn_pause_ms=100,
    )
    assert result.characters == len("مرحبًا.") + len("Hello!") + len("شكرًا.")
    with wave.open(str(result.path), "rb") as audio:
        assert audio.getnchannels() == 1
        assert audio.getsampwidth() == 2
        assert audio.getnframes() / audio.getframerate() == pytest.approx(3.2, abs=0.001)
