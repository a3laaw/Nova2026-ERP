"""Real sample-clock accounting, without a trained voice or per-line audio files."""

import wave
from dataclasses import replace
from threading import Event
from types import SimpleNamespace

import pytest

from nova_voice.engine import (
    AudioError,
    DialogueVoice,
    RenderOptions,
    RenderResult,
    SpeechEngine,
    SpeechLine,
)
from nova_voice.pcm import resample_pcm16
from nova_voice.text import split_text
from nova_voice.timing import ClipTiming
from nova_voice.voices import Cancelled
from tools.measure_mp3_delay import RATES, measure_rate


def fake_models(monkeypatch, engine, counts):
    calls = []

    def load(spec):
        def synthesize(text, syn_config):
            calls.append((spec.sample_rate, text, syn_config.speaker_id))
            for count in counts(text):
                yield SimpleNamespace(
                    sample_rate=spec.sample_rate,
                    sample_width=2,
                    sample_channels=1,
                    audio_int16_bytes=bytes(count * 2),
                )

        return SimpleNamespace(
            config=SimpleNamespace(sample_rate=spec.sample_rate, length_scale=1.0),
            synthesize=synthesize,
        )

    monkeypatch.setattr(engine, "_load", load)
    return calls


def test_old_result_constructor_and_render_interfaces_remain_compatible(tmp_path, voice_spec):
    assert RenderResult(tmp_path / "old.wav", 1.0, 4).timing is None
    result = SpeechEngine().render("Hello.", voice_spec, tmp_path / "old.wav", RenderOptions())
    assert result.duration_seconds == pytest.approx(1)
    assert result.timing is None  # Measurement is opt-in, not a hidden API change.


def test_line_spans_plus_actual_gaps_equal_the_single_written_wav(
    tmp_path, voice_spec, monkeypatch
):
    engine = SpeechEngine()
    fake_models(monkeypatch, engine, lambda _: [37, 61])
    result = engine.render_lines(
        [SpeechLine(0, "First.", pause_after_ms=251), SpeechLine(1, "Second.")],
        {1: DialogueVoice(voice_spec)},
        tmp_path / "step.wav",
        RenderOptions(),
    )
    timing = result.timing
    gap = round(voice_spec.sample_rate * 251 / 1000)
    first, second = timing.lines
    assert (first.start_sample, first.end_sample, first.pause_after_samples) == (0, 98, gap)
    assert (second.start_sample, second.end_sample) == (98 + gap, 196 + gap)
    assert second.pause_after_samples == 0
    assert (
        sum(line.end_sample - line.start_sample + line.pause_after_samples for line in timing.lines)
        == timing.total_samples
    )
    with wave.open(str(result.path), "rb") as audio:
        assert audio.getnframes() == timing.total_samples
        assert audio.getframerate() == timing.sample_rate
    assert result.duration_seconds == pytest.approx(
        (196 + gap) / timing.sample_rate, abs=1 / timing.sample_rate
    )
    assert timing.line_seconds[1] == (
        1,
        second.start_sample / timing.sample_rate,
        second.end_sample / timing.sample_rate,
    )
    assert list(tmp_path.glob("*.wav")) == [result.path]


def test_two_voices_count_each_soxr_output_not_source_samples(
    tmp_path, bilingual_cast, monkeypatch
):
    cast = dict(bilingual_cast)
    cast[2] = DialogueVoice(replace(cast[2].voice, sample_rate=24000))
    engine = SpeechEngine()
    calls = fake_models(monkeypatch, engine, lambda _: [101, 133])
    result = engine.render_lines(
        [SpeechLine(0, "مرحبًا.", 1, 333), SpeechLine(1, "Hello.", 2)],
        cast,
        tmp_path / "bilingual.wav",
        RenderOptions(),
    )
    converted = sum(
        len(resample_pcm16(bytes(count * 2), 22050, 24000)) // 2 for count in (101, 133)
    )
    assert result.timing.sample_rate == 24000
    assert result.timing.lines[0].end_sample == converted
    assert result.timing.lines[0].end_sample != 234
    assert result.timing.lines[1].start_sample == converted + round(24000 * 0.333)
    assert result.timing.lines[1].end_sample - result.timing.lines[1].start_sample == 234
    assert [rate for rate, _, _ in calls] == [22050, 24000]
    with wave.open(str(result.path), "rb") as audio:
        assert audio.getnframes() == result.timing.total_samples


def test_long_line_pieces_retain_the_original_id_before_synthesis(
    tmp_path, voice_spec, monkeypatch
):
    engine = SpeechEngine()
    long_text = "word " * 260
    captured = []
    original = engine._render

    def render(blocks, *args):
        captured.extend(blocks)
        return original(blocks, *args)

    monkeypatch.setattr(engine, "_render", render)
    calls = fake_models(monkeypatch, engine, lambda text: [len(text) * 3])
    pieces = split_text(long_text)
    assert len(pieces) >= 3
    result = engine.render_lines(
        [SpeechLine(0, long_text), SpeechLine(1, "Last.")],
        {1: DialogueVoice(voice_spec)},
        tmp_path / "one-step.wav",
        RenderOptions(),
    )
    assert [block.line_id for block in captured] == [0] * len(pieces) + [1]
    assert [block.text for block in captured[:-1]] == [piece.text for piece in pieces]
    assert len(result.timing.lines) == 2
    assert result.timing.lines[0].end_sample == sum(len(piece.text) * 3 for piece in pieces)
    assert result.timing.lines[1].start_sample == result.timing.lines[0].end_sample
    assert len(calls) == len(pieces) + 1
    assert list(tmp_path.glob("*.wav")) == [result.path]


def test_internal_paragraph_pause_and_external_reply_gap_are_not_double_counted(
    tmp_path, voice_spec, monkeypatch
):
    engine = SpeechEngine()
    fake_models(monkeypatch, engine, lambda _: [110])
    result = engine.render_lines(
        [
            SpeechLine(0, "First.\nSecond.", pause_after_ms=350),
            SpeechLine(1, "Last.", pause_after_ms=500),
        ],
        {1: DialogueVoice(voice_spec)},
        tmp_path / "paragraphs.wav",
        RenderOptions(pause_ms=250),
    )
    timing = result.timing
    internal = round(timing.sample_rate * 0.250)
    reply = round(timing.sample_rate * 350 / 1000)
    assert timing.lines[0].end_sample == 220 + internal
    assert timing.lines[0].pause_after_samples == reply
    assert timing.lines[1].start_sample == 220 + internal + reply
    assert timing.lines[-1].pause_after_samples == 0  # No trailing engine pause.
    assert timing.total_samples == 330 + internal + reply
    assert ClipTiming.from_data(timing.to_data(), (1, 1)) == timing


def test_timed_cancellation_keeps_the_old_output_and_publishes_no_partial_map(
    tmp_path, voice_spec, monkeypatch
):
    path = tmp_path / "previous.mp3"
    path.write_bytes(b"old complete audio")
    event = Event()
    engine = SpeechEngine()
    fake_models(monkeypatch, engine, lambda _: [2205])
    with pytest.raises(Cancelled):
        engine.render_lines(
            [SpeechLine(0, "First."), SpeechLine(1, "Second.")],
            {1: DialogueVoice(voice_spec)},
            path,
            RenderOptions(),
            event,
            lambda value: event.set() if value > 0 else None,
        )
    assert path.read_bytes() == b"old complete audio"
    assert not list(tmp_path.glob(".nova-voice-*"))


@pytest.mark.parametrize(
    "lines",
    [
        [],
        [SpeechLine(1, "Hello.")],
        [SpeechLine(True, "Hello.")],
        [SpeechLine(0, "Hello.", 3)],
        [SpeechLine(0, "Hello.", pause_after_ms=-1)],
        [SpeechLine(0, "Hello.", pause_after_ms=2001)],
    ],
)
def test_invalid_line_identity_or_pause_fails_before_any_model_load(
    tmp_path, voice_spec, monkeypatch, lines
):
    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", lambda _: pytest.fail("Invalid plan reached a model"))
    with pytest.raises(AudioError):
        engine.render_lines(
            lines, {1: DialogueVoice(voice_spec)}, tmp_path / "no.wav", RenderOptions()
        )
    assert not (tmp_path / "no.wav").exists()


@pytest.mark.parametrize("rate", RATES)
def test_mp3_and_wav_share_measured_pcm_clock_but_mp3_has_observed_codec_delay(tmp_path, rate):
    measured = measure_rate(rate, tmp_path)
    assert measured["wav_timing_samples"] == measured["mp3_timing_samples"] == rate
    # Actually decoded/correlated, not a timing offset guessed/applied by the app.
    # Pinned lameenc 1.9.0 / miniaudio 1.72; update the documented measurement if changed.
    assert measured["measured_delay_samples"] == 1105
    assert 0 <= measured["trailing_samples"] < 1152
    assert measured["decoded_mp3_samples"] == rate + 1105 + measured["trailing_samples"]


def test_real_piper_silent_fixture_returns_measured_rows_without_per_row_files(
    tmp_path, voice_spec
):
    result = SpeechEngine().render_lines(
        [SpeechLine(0, "Hello."), SpeechLine(1, "Another sentence.")],
        {1: DialogueVoice(voice_spec)},
        tmp_path / "piper-step.wav",
        RenderOptions(),
    )
    assert result.timing.lines[0].end_sample == 22050
    assert result.timing.lines[1].start_sample == 22050
    assert result.timing.total_samples == 44100
    assert result.duration_seconds == 2
    assert list(tmp_path.glob("*.wav")) == [result.path]
