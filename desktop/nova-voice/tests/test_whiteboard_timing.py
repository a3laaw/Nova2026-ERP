"""Lesson-bound timing JSON, strict reimport and one streamed clip per step."""

import base64
import copy
import hashlib
import io
import json
import re
import wave
from dataclasses import replace
from types import SimpleNamespace

import pytest

from nova_voice.engine import DialogueVoice, RenderOptions, SpeechEngine
from nova_voice.timing import (
    TIMINGS_ID,
    ClipTiming,
    LineTiming,
    TimingError,
    TimingMap,
    data_fingerprint,
)
from nova_voice.whiteboard import (
    RECORDINGS_ID,
    WhiteboardError,
    WhiteboardPage,
    _safe_json,
    parse_lesson,
    render_whiteboard_audio,
    save_whiteboard,
)


def json_node(content, identifier):
    return json.loads(
        re.search(
            rf'<script id="{identifier}" type="application/json">(.*?)</script>', content, re.S
        )[1]
    )


def replace_node(content, identifier, value):
    return re.sub(
        rf'(<script id="{identifier}" type="application/json">).*?(</script>)',
        lambda match: match[1] + _safe_json(value) + match[2],
        content,
        flags=re.S,
    )


def fixture_map():
    clip = ClipTiming(
        8000,
        300,
        (
            LineTiming(0, 1, 0, 100, 10),
            LineTiming(1, 2, 110, 300, 0),
        ),
        "wav",
    )
    return TimingMap("a" * 64, (clip,))


def resign(data):
    data["fingerprint"] = data_fingerprint(
        {key: value for key, value in data.items() if key != "fingerprint"}
    )
    return data


def test_schema_and_integer_sample_data_round_trip_and_expose_seconds():
    timing = fixture_map()
    data = timing.to_data()
    assert data["schema_version"] == 1
    assert data["steps"]["0"]["clock"] == "pcm"
    assert data["steps"]["0"]["encoder_delay_samples"] == 0
    assert TimingMap.from_data(data, "a" * 64, ((1, 2),), [300 / 8000]) == timing
    assert timing.steps[0].line_seconds == ((0, 0, 0.0125), (1, 0.01375, 0.0375))
    canonical = json.dumps(
        {key: value for key, value in data.items() if key != "fingerprint"},
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    )
    assert data["fingerprint"] == hashlib.sha256(canonical.encode("ascii")).hexdigest()


def test_structurally_valid_timing_edit_is_detected_by_the_bound_fingerprint():
    data = fixture_map().to_data()
    data["steps"]["0"]["lines"][0]["end_sample"] += 1
    data["steps"]["0"]["lines"][0]["pause_after_samples"] -= 1
    with pytest.raises(TimingError, match="fingerprint"):
        TimingMap.from_data(data, "a" * 64, ((1, 2),), [300 / 8000])
    with pytest.raises(TimingError, match="another lesson"):
        TimingMap.from_data(fixture_map().to_data(), "b" * 64, ((1, 2),), [300 / 8000])


@pytest.mark.parametrize(
    "change",
    [
        "schema",
        "boolean-schema",
        "missing-step",
        "extra-step",
        "missing-line",
        "duplicate-line",
        "negative",
        "boolean-count",
        "fractional-count",
        "nan",
        "infinity",
        "unsafe-integer",
        "wrong-role",
        "out-of-order",
        "overlap",
        "uncovered-gap",
        "out-of-bounds",
        "tail-gap",
        "wrong-clock",
        "bad-rate",
        "mp3-false-zero-delay",
        "unknown-field",
    ],
)
def test_invalid_maps_are_rejected_even_if_someone_recomputes_the_checksum(change):
    data = fixture_map().to_data()
    clip = data["steps"]["0"]
    first, last = clip["lines"]
    if change == "schema":
        data["schema_version"] = 2
    elif change == "boolean-schema":
        data["schema_version"] = True
    elif change == "missing-step":
        data["steps"] = {}
    elif change == "extra-step":
        data["steps"]["1"] = copy.deepcopy(clip)
    elif change == "missing-line":
        clip["lines"].pop()
    elif change == "duplicate-line":
        last["line_id"] = 0
    elif change == "negative":
        first["start_sample"] = -1
    elif change == "boolean-count":
        first["start_sample"] = False
    elif change == "fractional-count":
        first["end_sample"] = 100.5
    elif change == "nan":
        first["end_sample"] = float("nan")
    elif change == "infinity":
        first["end_sample"] = float("inf")
    elif change == "unsafe-integer":
        clip["total_samples"] = 2**53
    elif change == "wrong-role":
        first["speaker"] = 2
    elif change == "out-of-order":
        clip["lines"].reverse()
    elif change == "overlap":
        last["start_sample"] = 90
    elif change == "uncovered-gap":
        last["start_sample"] = 111
    elif change == "out-of-bounds":
        last["end_sample"] = 301
    elif change == "tail-gap":
        last["pause_after_samples"] = 10
    elif change == "wrong-clock":
        clip["clock"] = "wall-time"
    elif change == "bad-rate":
        clip["sample_rate"] = 0
    elif change == "mp3-false-zero-delay":
        clip["audio_format"] = "mp3"
    elif change == "unknown-field":
        first["model_path"] = "not allowed"
    with pytest.raises(TimingError):
        TimingMap.from_data(resign(data), "a" * 64, ((1, 2),), [300 / 8000])


def test_duration_mismatch_and_unknown_mp3_delay_are_explicit():
    data = fixture_map().to_data()
    with pytest.raises(TimingError, match="duration"):
        TimingMap.from_data(data, "a" * 64, ((1, 2),), [1])
    data["steps"]["0"]["audio_format"] = "mp3"
    data["steps"]["0"]["encoder_delay_samples"] = None
    loaded = TimingMap.from_data(resign(data), "a" * 64, ((1, 2),), [300 / 8000])
    assert loaded.steps[0].to_data()["encoder_delay_samples"] is None


def test_json_raw_text_escaping_is_used_for_timing_metadata_too():
    value = {"sample": "</script><script>alert(1)</script>&العربية"}
    safe = _safe_json(value)
    assert "</script" not in safe and "&" not in safe
    assert json.loads(safe) == value


@pytest.fixture
def narrated_board(tmp_path, bilingual_cast, monkeypatch):
    cast = dict(bilingual_cast)
    cast[2] = DialogueVoice(replace(cast[2].voice, sample_rate=24000))
    lesson = parse_lesson(
        "# Timing lesson\n## First\n[1] مرحبًا.[/1][2] Hello.[/2][1] شكرًا.[/1]"
        "\n## Second\n[2] Goodbye.[/2]",
        dialogue=True,
    )
    source, output = tmp_path / "silent.html", tmp_path / "audio.html"
    save_whiteboard(lesson, source)
    engine = SpeechEngine()
    plans = []
    original_render = engine.render_lines

    def render(lines, cast, destination, *args):
        plans.append((tuple(lines), destination))
        return original_render(lines, cast, destination, *args)

    def load(spec):
        def synthesize(text, syn_config):
            yield SimpleNamespace(
                sample_rate=spec.sample_rate,
                sample_width=2,
                sample_channels=1,
                audio_int16_bytes=bytes((spec.sample_rate // 20 + len(text) * 5) * 2),
            )

        return SimpleNamespace(
            config=SimpleNamespace(sample_rate=spec.sample_rate, length_scale=1.0),
            synthesize=synthesize,
        )

    monkeypatch.setattr(engine, "_load", load)
    monkeypatch.setattr(engine, "render_lines", render)
    original_source = source.read_bytes()
    render_whiteboard_audio(engine, source, cast, output, RenderOptions(), audio_format="wav")
    assert source.read_bytes() == original_source
    return source, output, lesson, plans, cast


def test_html_has_one_stream_per_step_and_verified_timing_readback(narrated_board):
    source, output, lesson, plans, cast = narrated_board
    content = output.read_text(encoding="utf-8-sig")
    loaded = WhiteboardPage.load(output, allow_recordings=True)
    assert loaded.lesson == lesson
    assert loaded.timing is not None
    assert len(plans) == len(lesson.steps) == 2
    assert [[line.line_id for line in plan] for plan, _ in plans] == [[0, 1, 2], [0]]
    assert [destination.name for _, destination in plans] == ["step-0.wav", "step-1.wav"]
    assert plans[0][0][0].pause_after_ms == 350
    data = json_node(content, TIMINGS_ID)
    assert data == loaded.timing.to_data()
    assert data["lesson_fingerprint"] == lesson.manifest()["fingerprint"]
    durations = json_node(content, RECORDINGS_ID)["durations"]
    payloads = re.findall(
        r'type="application/x-nova-audio" data-mime="audio/wav">([^<]+)</script>', content
    )
    assert len(payloads) == len(lesson.steps)
    for index, payload in enumerate(payloads):
        with wave.open(io.BytesIO(base64.b64decode(payload)), "rb") as audio:
            timing = loaded.timing.steps[index]
            assert audio.getframerate() == timing.sample_rate
            assert audio.getnframes() == timing.total_samples
            assert (
                abs(durations[index] - audio.getnframes() / audio.getframerate())
                <= 1 / audio.getframerate()
            )
    assert all(str(assignment.voice.model_path) not in content for assignment in cast.values())
    assert source.exists()
    with pytest.raises(WhiteboardError, match="بالفعل"):
        WhiteboardPage.load(output)  # Default regeneration protection is unchanged.


@pytest.mark.parametrize(
    "change", ["checksum", "duplicate", "duration", "missing-row", "wrong-type"]
)
def test_html_reimport_rejects_modified_timing_or_recording_metadata(narrated_board, change):
    _, output, _, _, _ = narrated_board
    content = output.read_text(encoding="utf-8-sig")
    data = json_node(content, TIMINGS_ID)
    if change == "checksum":
        first = data["steps"]["0"]["lines"][0]
        first["end_sample"] += 1
        first["pause_after_samples"] -= 1
        content = replace_node(content, TIMINGS_ID, data)
    elif change == "duplicate":
        tag = re.search(rf'<script id="{TIMINGS_ID}".*?</script>', content, re.S)[0]
        content = content.replace(tag, tag + tag)
    elif change == "duration":
        recordings = json_node(content, RECORDINGS_ID)
        recordings["durations"][0] += 0.1
        content = replace_node(content, RECORDINGS_ID, recordings)
    elif change == "missing-row":
        data["steps"]["0"]["lines"].pop()
        content = replace_node(content, TIMINGS_ID, resign(data))
    else:
        content = content.replace(
            f'id="{TIMINGS_ID}" type="application/json"',
            f'id="{TIMINGS_ID}" type="text/javascript"',
        )
    output.write_text(content, encoding="utf-8")
    with pytest.raises(WhiteboardError):
        WhiteboardPage.load(output, allow_recordings=True)


def test_old_narrated_html_without_optional_map_still_reads(narrated_board):
    _, output, lesson, _, _ = narrated_board
    content = re.sub(
        rf'<script id="{TIMINGS_ID}".*?</script>',
        "",
        output.read_text(encoding="utf-8-sig"),
        flags=re.S,
    )
    output.write_text(content, encoding="utf-8")
    loaded = WhiteboardPage.load(output, allow_recordings=True)
    assert loaded.lesson == lesson and loaded.timing is None


def test_new_narration_upgrades_the_saved_controller_without_executing_or_changing_source(
    tmp_path, voice_spec
):
    lesson = parse_lesson("# Historical board\n## Step\nHello.")
    source, output = tmp_path / "old.html", tmp_path / "new.html"
    save_whiteboard(lesson, source)
    content = source.read_text(encoding="utf-8-sig")
    content = re.sub(
        r"<script>.*?</script>\s*</body>",
        '<script>throw new Error("old controller must not execute");</script></body>',
        content,
        flags=re.S,
    )
    source.write_text(content, encoding="utf-8")
    original = source.read_bytes()
    render_whiteboard_audio(
        SpeechEngine(),
        source,
        {1: DialogueVoice(voice_spec)},
        output,
        RenderOptions(),
        audio_format="wav",
    )
    assert source.read_bytes() == original
    assert "old controller must not execute" not in output.read_text(encoding="utf-8-sig")
    assert WhiteboardPage.load(output, allow_recordings=True).timing is not None


@pytest.mark.parametrize("threshold", [1, 86])
def test_measured_synthesis_and_embedding_cancellation_are_atomic(tmp_path, voice_spec, threshold):
    from threading import Event

    from nova_voice.voices import Cancelled

    source, output = tmp_path / "source.html", tmp_path / "old-output.html"
    save_whiteboard(parse_lesson("# Lesson\n## One\nHello.\n## Two\nGoodbye."), source)
    original = source.read_bytes()
    output.write_bytes(b"old complete output")
    event = Event()
    with pytest.raises(Cancelled):
        render_whiteboard_audio(
            SpeechEngine(),
            source,
            {1: DialogueVoice(voice_spec)},
            output,
            RenderOptions(),
            event,
            lambda value: event.set() if value >= threshold else None,
            audio_format="wav",
        )
    assert source.read_bytes() == original
    assert output.read_bytes() == b"old complete output"
    assert not list(tmp_path.glob(".nova-whiteboard-*"))


@pytest.mark.parametrize("problem", ["missing", "samples", "duration"])
def test_invalid_measured_result_does_not_replace_an_existing_html(
    tmp_path, voice_spec, monkeypatch, problem
):
    source, output = tmp_path / "source.html", tmp_path / "old-output.html"
    save_whiteboard(parse_lesson("# Lesson\nHello."), source)
    output.write_bytes(b"old complete output")
    engine = SpeechEngine()
    original = engine.render_lines

    def render(*args, **kwargs):
        result = original(*args, **kwargs)
        if problem == "missing":
            return replace(result, timing=None)
        if problem == "samples":
            return replace(
                result, timing=replace(result.timing, total_samples=result.timing.total_samples + 1)
            )
        return replace(result, duration_seconds=result.duration_seconds + 1)

    monkeypatch.setattr(engine, "render_lines", render)
    with pytest.raises((WhiteboardError, TimingError)):
        render_whiteboard_audio(
            engine,
            source,
            {1: DialogueVoice(voice_spec)},
            output,
            RenderOptions(),
            audio_format="wav",
        )
    assert output.read_bytes() == b"old complete output"
    assert not list(tmp_path.glob(".nova-whiteboard-*"))


def test_measured_same_role_rows_have_no_added_gap_or_separate_audio_files(tmp_path, voice_spec):
    source, output = tmp_path / "source.html", tmp_path / "audio.html"
    save_whiteboard(parse_lesson("# Lesson\nHello.\nAnother sentence."), source)
    render_whiteboard_audio(
        SpeechEngine(),
        source,
        {1: DialogueVoice(voice_spec)},
        output,
        RenderOptions(),
        audio_format="wav",
    )
    clip = WhiteboardPage.load(output, allow_recordings=True).timing.steps[0]
    assert len(clip.lines) == 2
    assert clip.lines[0].end_sample == clip.lines[1].start_sample == 22050
    assert all(line.pause_after_samples == 0 for line in clip.lines)
    assert clip.total_samples == 44100
    assert not list(tmp_path.glob("*.wav"))  # Step audio was temporary; none per row.


def test_existing_total_audio_limit_also_guards_the_measured_path(
    tmp_path, voice_spec, monkeypatch
):
    source, output = tmp_path / "source.html", tmp_path / "old-output.html"
    save_whiteboard(parse_lesson("# Lesson\nHello."), source)
    output.write_bytes(b"old complete output")
    monkeypatch.setattr("nova_voice.whiteboard.MAX_AUDIO_BYTES", 100)
    with pytest.raises(WhiteboardError, match="256"):
        render_whiteboard_audio(
            SpeechEngine(),
            source,
            {1: DialogueVoice(voice_spec)},
            output,
            RenderOptions(),
            audio_format="wav",
        )
    assert output.read_bytes() == b"old complete output"
