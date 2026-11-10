"""Real local encoders/HTML with simulated Azure PCM, not a voice-quality test."""

import base64
import builtins
import io
import re
import wave
from dataclasses import replace
from threading import Event
from xml.etree import ElementTree

import pytest
from test_azure_speech import KEY, PCM, SALMA, SHAKIR, SONIA, make_job, speech
from test_scenes import fixture_lesson, fixture_plan

from nova_voice.azure_speech import AzureError, AzurePlan
from nova_voice.engine import (
    AudioError,
    DialogueVoice,
    RenderOptions,
    SpeechEngine,
    SpeechLine,
)
from nova_voice.html_export import render_html
from nova_voice.scenes import VisualPlan, empty_plan
from nova_voice.text import split_text
from nova_voice.voices import Cancelled, VoiceError
from nova_voice.whiteboard import (
    WhiteboardPage,
    parse_lesson,
    render_whiteboard_audio,
    render_whiteboard_with_audio,
    save_whiteboard,
    whiteboard_cloud_requests,
    whiteboard_speech_lines,
)


def recording_engine(requests, *, responses=None):
    sent = []
    source = iter(responses) if responses is not None else None

    def transport(request, cancel):
        sent.append(request)
        result = next(source) if source is not None else PCM
        if isinstance(result, Exception):
            raise result
        return result

    job = make_job(requests, _transport=transport)
    return SpeechEngine(azure_job=job), sent, job


def sent_text(sent):
    ns = "{http://www.w3.org/2001/10/synthesis}"
    return [
        ElementTree.fromstring(request.data).find(f"{ns}voice/{ns}prosody").text for request in sent
    ]


def test_local_default_does_not_authorize_azure_or_create_an_output(tmp_path):
    engine = SpeechEngine()
    with pytest.raises(AzureError, match="مراجعة"):
        engine.render("مرحبًا.", SALMA, tmp_path / "never.wav", RenderOptions())
    assert not list(tmp_path.iterdir())


def test_cloud_plan_matches_narration_preprocessing_and_real_wav_bytes_without_importing_piper(
    tmp_path, monkeypatch
):
    text = "اسمي ____.\nكيف حالك؟"
    options = RenderOptions(pause_ms=250, speed=0.85)
    requests = SpeechEngine().script_cloud_requests(text, {1: DialogueVoice(SALMA)}, options)
    assert [r.text for r in requests] == ["اسمي ….", "كيف حالك؟"]
    assert all(r.speed == 0.85 for r in requests)
    engine, sent, job = recording_engine(requests)
    original_import = builtins.__import__

    def no_local_model(name, *args, **kwargs):
        assert name not in ("piper", "onnxruntime")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", no_local_model)
    progress = []
    result = engine.render(text, SALMA, tmp_path / "azure.wav", options, progress=progress.append)
    with wave.open(str(result.path), "rb") as wav:
        assert (wav.getframerate(), wav.getsampwidth(), wav.getnchannels()) == (24000, 2, 1)
        assert wav.readframes(wav.getnframes()) == PCM + bytes(12000) + PCM
    assert sent_text(sent) == [r.text for r in requests]
    assert result.duration_seconds == pytest.approx(0.45)
    assert result.characters == sum(len(r.text) for r in requests)
    assert result.timing is None and progress[0] == -1 and progress[-1] == 100
    assert job._index == 2 and not engine._voices
    assert not list(tmp_path.glob(".nova-voice-*"))
    job.close()


@pytest.mark.parametrize("change", ["text", "voice", "speed", "shorter"])
def test_changed_or_truncated_whole_script_fails_before_dispatch_or_output(tmp_path, change):
    text = "مرحبًا.\nأهلًا."
    options = RenderOptions()
    requests = SpeechEngine().script_cloud_requests(text, {1: DialogueVoice(SALMA)}, options)
    engine, sent, job = recording_engine(requests)
    if change == "text":
        text = "نص جديد.\nأهلًا."
    elif change == "speed":
        options = replace(options, speed=0.85)
    elif change == "shorter":
        text = "مرحبًا."
    with pytest.raises(AzureError):
        engine.render(text, SHAKIR if change == "voice" else SALMA, tmp_path / "never.wav", options)
    assert not sent and not list(tmp_path.iterdir())
    job.close()


@pytest.mark.parametrize(
    "cast, text",
    [
        ({1: DialogueVoice(SONIA)}, "مرحبًا."),
        ({1: DialogueVoice(SALMA)}, "Hello."),
        ({1: DialogueVoice(SALMA)}, "مرحبًا Hello."),
    ],
)
def test_language_guards_do_not_silently_switch_translate_or_send(tmp_path, cast, text):
    with pytest.raises(VoiceError):
        SpeechEngine().script_cloud_requests(text, cast, RenderOptions())
    assert not list(tmp_path.iterdir())


def test_distinct_arabic_azure_voices_are_accepted_same_voice_rejected():
    engine = SpeechEngine()
    script = "[1] مرحبًا.[/1][2] أهلًا.[/2]"
    requests = engine.script_cloud_requests(
        script, {1: DialogueVoice(SALMA), 2: DialogueVoice(SHAKIR)}, RenderOptions(), dialogue=True
    )
    assert [r.voice for r in requests] == [SALMA, SHAKIR]
    with pytest.raises(VoiceError, match="الصوتان"):
        engine.script_cloud_requests(
            script,
            {1: DialogueVoice(SALMA), 2: DialogueVoice(SALMA)},
            RenderOptions(),
            dialogue=True,
        )


def test_bilingual_turns_are_sent_in_source_order_with_real_gap_samples(tmp_path):
    text = "[1] مرحبًا.[/1][2] Hello.[/2][1] أهلًا.[/1]"
    cast = {1: DialogueVoice(SALMA), 2: DialogueVoice(SONIA)}
    options = RenderOptions()
    requests = SpeechEngine().script_cloud_requests(text, cast, options, dialogue=True)
    engine, sent, job = recording_engine(requests)
    result = engine.render_dialogue(
        text, cast, tmp_path / "dialogue.wav", options, turn_pause_ms=350
    )
    assert sent_text(sent) == ["مرحبًا.", "Hello.", "أهلًا."]
    assert [r.voice for r in requests] == [SALMA, SONIA, SALMA]
    with wave.open(str(result.path), "rb") as wav:
        assert wav.readframes(wav.getnframes()) == PCM + bytes(16800) + PCM + bytes(16800) + PCM
        assert wav.getnframes() == round(result.duration_seconds * 24000)
    assert result.duration_seconds == pytest.approx(1)
    job.close()


def test_long_logical_rows_keep_ids_and_pcm_timing_across_cloud_chunks(tmp_path):
    lines = (SpeechLine(0, "word " * 260, pause_after_ms=321), SpeechLine(1, "Last."))
    cast = {1: DialogueVoice(SONIA)}
    options = RenderOptions()
    requests = SpeechEngine().line_cloud_requests(lines, cast, options)
    assert len(requests) == len(split_text(lines[0].text)) + 1 and len(requests) >= 4
    engine, sent, job = recording_engine(requests)
    result = engine.render_lines(lines, cast, tmp_path / "timed.wav", options)
    timing = result.timing
    assert len(timing.lines) == 2 and timing.sample_rate == 24000
    first, last = timing.lines
    assert (first.line_id, last.line_id) == (0, 1)
    assert first.end_sample == (len(requests) - 1) * len(PCM) // 2
    assert first.pause_after_samples == round(24000 * 0.321)
    assert last.start_sample == first.end_sample + first.pause_after_samples
    assert last.end_sample - last.start_sample == len(PCM) // 2
    assert last.end_sample == timing.total_samples and last.pause_after_samples == 0
    with wave.open(str(result.path), "rb") as wav:
        assert wav.getnframes() == timing.total_samples
    assert sent_text(sent) == [r.text for r in requests]
    assert list(tmp_path.glob("*.wav")) == [result.path]
    job.close()


def test_real_mp3_encoder_uses_cloud_pcm_and_remains_decodable(tmp_path):
    import miniaudio

    request = speech()
    engine, sent, job = recording_engine((request,))
    result = engine.render(request.text, SALMA, tmp_path / "cloud.mp3", RenderOptions())
    data = result.path.read_bytes()
    assert data[0] == 0xFF and data[1] & 0xE0 == 0xE0 and len(data) > 1000
    decoded = miniaudio.decode_file(str(result.path), nchannels=1, sample_rate=24000)
    assert any(decoded.samples) and result.duration_seconds == pytest.approx(0.1)
    assert sent_text(sent) == [request.text]
    job.close()


@pytest.mark.parametrize(
    "failure", [AzureError("الحصة انتهت بلا إعادة"), RuntimeError(KEY), b"bad"]
)
def test_failure_after_one_request_keeps_previous_output_and_drops_key(tmp_path, failure):
    text = "مرحبًا.\nأهلًا."
    requests = SpeechEngine().script_cloud_requests(
        text, {1: DialogueVoice(SALMA)}, RenderOptions()
    )
    engine, sent, job = recording_engine(requests, responses=[PCM, failure])
    path = tmp_path / "previous.wav"
    path.write_bytes(b"ORIGINAL_AUDIO")
    with pytest.raises(AzureError) as captured:
        engine.render(text, SALMA, path, RenderOptions())
    assert path.read_bytes() == b"ORIGINAL_AUDIO" and len(sent) == 2
    assert KEY not in str(captured.value) and job._credentials is None
    assert not list(tmp_path.glob(".nova-voice-*"))


def test_cancel_after_response_keeps_previous_file_without_next_request(tmp_path):
    text = "مرحبًا.\nأهلًا."
    requests = SpeechEngine().script_cloud_requests(
        text, {1: DialogueVoice(SALMA)}, RenderOptions()
    )
    cancel = Event()
    sent = []

    def transport(request, event):
        sent.append(request)
        cancel.set()
        return PCM

    job = make_job(requests, _transport=transport)
    path = tmp_path / "previous.wav"
    path.write_bytes(b"ORIGINAL_AUDIO")
    with pytest.raises(Cancelled):
        SpeechEngine(azure_job=job).render(text, SALMA, path, RenderOptions(), cancel)
    assert path.read_bytes() == b"ORIGINAL_AUDIO" and len(sent) == 1
    assert job._credentials is None and not list(tmp_path.glob(".nova-voice-*"))


def reviewed_lesson():
    data, source = fixture_plan()
    return replace(fixture_lesson(), visuals=VisualPlan.from_data(data, source))


@pytest.mark.parametrize("mode", ["combined", "saved"])
@pytest.mark.parametrize("audio_format", ["wav", "mp3"])
def test_board_uses_exact_saved_speech_not_headings_displays_or_current_editor(
    tmp_path, mode, audio_format
):
    lesson = reviewed_lesson()
    cast, options = {1: DialogueVoice(SONIA)}, RenderOptions(speed=0.85)
    requests = whiteboard_cloud_requests(SpeechEngine(), lesson, cast, options)
    assert [r.text for r in requests] == [
        "Two apples.",
        "Add three apples.",
        "There are five apples.",
        "A right triangle.",
    ]
    review = AzurePlan(requests).review_text
    assert "Numbers" not in review and "Addition" not in review and "= 5" not in review
    engine, sent, job = recording_engine(requests)
    path = tmp_path / "with-audio.html"
    if mode == "combined":
        render_whiteboard_with_audio(engine, lesson, cast, path, options, audio_format=audio_format)
    else:
        source = tmp_path / "silent.html"
        save_whiteboard(lesson, source)
        original = source.read_bytes()
        render_whiteboard_audio(engine, source, cast, path, options, audio_format=audio_format)
        assert source.read_bytes() == original
    board = WhiteboardPage.load(path, allow_recordings=True)
    assert board.lesson == lesson and board.timing is not None
    assert len(board.timing.steps) == len(lesson.steps)
    assert all(
        step.sample_rate == 24000 and step.audio_format == audio_format
        for step in board.timing.steps
    )
    content = path.read_text(encoding="utf-8-sig")
    assert KEY not in content and "eastus.tts.speech.microsoft.com" not in content
    assert "Ocp-Apim-Subscription-Key" not in content and "ar-EG-SalmaNeural" not in content
    assert sent_text(sent) == [r.text for r in requests]
    assert len(sent) == len(requests)
    if audio_format == "wav":
        recordings = re.findall(
            r'<script[^>]+type="application/x-nova-audio"[^>]*>(.*?)</script>', content, re.S
        )
        assert len(recordings) == 2
        for recording, timing in zip(recordings, board.timing.steps, strict=True):
            with wave.open(io.BytesIO(base64.b64decode(recording)), "rb") as wav:
                assert wav.getnframes() == timing.total_samples
    job.close()


def test_changed_last_step_is_detected_before_any_earlier_request(tmp_path):
    lesson = parse_lesson("# Title\n## First\nHello.\n## Last\nGoodbye.")
    cast, options = {1: DialogueVoice(SONIA)}, RenderOptions()
    requests = whiteboard_cloud_requests(SpeechEngine(), lesson, cast, options)
    engine, sent, job = recording_engine(requests)
    changed = parse_lesson(lesson.script.replace("Goodbye.", "Different last step."))
    source = tmp_path / "changed.html"
    save_whiteboard(changed, source)
    destination = tmp_path / "previous.html"
    destination.write_bytes(b"PREVIOUS_EXPORT")
    with pytest.raises(AzureError, match="تغير"):
        render_whiteboard_audio(engine, source, cast, destination, options)
    assert not sent and destination.read_bytes() == b"PREVIOUS_EXPORT"
    job.close()


def test_sacred_saved_board_is_blocked_even_if_current_cloud_job_is_general(tmp_path):
    lesson = parse_lesson("# Local reviewed text\n## Read\nHello.")
    data = empty_plan(lesson.manifest())
    data["policy"] = "sacred"
    lesson = replace(lesson, visuals=VisualPlan.from_data(data, lesson.manifest()))
    source = tmp_path / "sacred.html"
    save_whiteboard(lesson, source)
    cast, options = {1: DialogueVoice(SONIA)}, RenderOptions()
    with pytest.raises(VoiceError):
        whiteboard_cloud_requests(SpeechEngine(), lesson, cast, options)
    engine, sent, job = recording_engine((speech("Hello.", SONIA),))
    with pytest.raises(VoiceError):
        render_whiteboard_audio(engine, source, cast, tmp_path / "never.html", options)
    assert not sent and not (tmp_path / "never.html").exists()
    job.close()


def test_bilingual_board_lines_and_pauses_share_the_actual_planning_helper(tmp_path):
    lesson = parse_lesson("# Lesson\n## Step\n[1] مرحبًا.[/1][2] Hello.[/2]", dialogue=True)
    cast, options = {1: DialogueVoice(SALMA), 2: DialogueVoice(SONIA)}, RenderOptions()
    lines = whiteboard_speech_lines(lesson, 0, 333)
    assert lines[0].pause_after_ms == 333 and lines[1].pause_after_ms == 0
    requests = whiteboard_cloud_requests(SpeechEngine(), lesson, cast, options, turn_pause_ms=333)
    engine, sent, job = recording_engine(requests)
    path = tmp_path / "complete.html"
    render_whiteboard_with_audio(
        engine, lesson, cast, path, options, turn_pause_ms=333, audio_format="wav"
    )
    board = WhiteboardPage.load(path, allow_recordings=True)
    assert board.timing.steps[0].lines[0].pause_after_samples == round(24000 * 0.333)
    assert sent_text(sent) == [r.text for r in requests]
    job.close()


def test_general_html_sends_only_reviewed_script_not_the_html_source(tmp_path):
    source = tmp_path / "source.html"
    source.write_text("<!doctype html><html><body><p>HTML_PRIVATE_SENTINEL</p></body></html>")
    original = source.read_bytes()
    cast, options = {1: DialogueVoice(SALMA)}, RenderOptions()
    requests = SpeechEngine().script_cloud_requests("مرحبًا.", cast, options)
    engine, sent, job = recording_engine(requests)
    result = render_html(
        engine, source, "مرحبًا.", cast, tmp_path / "copy.html", options, audio_format="wav"
    )
    assert sent_text(sent) == ["مرحبًا."] and source.read_bytes() == original
    content = result.path.read_text(encoding="utf-8-sig")
    assert "HTML_PRIVATE_SENTINEL" in content and "nova-voice-player" in content
    assert KEY not in content and all(b"HTML_PRIVATE_SENTINEL" not in r.data for r in sent)
    job.close()


def test_mixed_local_and_cloud_cast_uses_original_local_sample_resampling(tmp_path, bilingual_cast):
    cast = {1: DialogueVoice(SALMA), 2: bilingual_cast[2]}
    lines = (SpeechLine(0, "مرحبًا.", 1, 0), SpeechLine(1, "Hello.", 2))
    requests = SpeechEngine().line_cloud_requests(lines, cast, RenderOptions())
    assert [r.voice for r in requests] == [SALMA]
    engine, sent, job = recording_engine(requests)
    result = engine.render_lines(lines, cast, tmp_path / "mixed.wav", RenderOptions())
    assert result.timing.sample_rate == 24000 and result.duration_seconds == pytest.approx(1.1)
    assert len(engine._voices) == 1 and len(sent) == 1
    job.close()


def test_invalid_format_and_options_do_not_dispatch(tmp_path):
    request = speech()
    engine, sent, job = recording_engine((request,))
    with pytest.raises(AudioError):
        engine.render(request.text, SALMA, tmp_path / "no.aac", RenderOptions())
    with pytest.raises(AudioError):
        engine.render(request.text, SALMA, tmp_path / "no.wav", RenderOptions(speaker_id=1))
    assert not sent and not list(tmp_path.iterdir())
    job.close()
