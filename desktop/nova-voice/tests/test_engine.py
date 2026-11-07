import json
import wave
from threading import Event
from types import SimpleNamespace

import pytest

from nova_voice.engine import AudioError, RenderOptions, SpeechEngine
from nova_voice.voices import Cancelled, VoiceSpec


def test_real_piper_wav_pipeline_is_offline(tmp_path, voice_spec):
    path = tmp_path / "صوت.wav"
    progress = []
    result = SpeechEngine().render(
        "First paragraph.\nSecond paragraph.",
        voice_spec,
        path,
        RenderOptions(pause_ms=250),
        progress=progress.append,
    )
    with wave.open(str(path), "rb") as audio:
        assert audio.getnchannels() == 1
        assert audio.getsampwidth() == 2
        assert audio.getframerate() == voice_spec.sample_rate
        assert audio.getnframes() / audio.getframerate() == pytest.approx(2.25, abs=0.001)
    assert result.duration_seconds == pytest.approx(2.25, abs=0.001)
    assert result.path == path
    assert progress[0] == -1
    assert progress[-1] == 100
    assert not list(tmp_path.glob(".nova-voice-*"))


def test_real_piper_mp3_encoding(tmp_path, voice_spec):
    path = tmp_path / "speech.mp3"
    result = SpeechEngine().render("Hello.", voice_spec, path, RenderOptions())
    data = path.read_bytes()
    assert len(data) > 1000
    assert data[0] == 0xFF and data[1] & 0xE0 == 0xE0
    assert result.duration_seconds == pytest.approx(1.0)


def test_arabic_phonemization_and_bundled_tashkeel(tmp_path, voice_files):
    model, config = voice_files
    data = json.loads(config.read_text())
    data["espeak"]["voice"] = "ar"
    data["language"] = {"code": "ar_JO", "name_native": "العربية"}
    config.write_text(json.dumps(data), encoding="utf-8")
    voice = VoiceSpec.from_path(model)
    result = SpeechEngine().render(
        "مرحبا بالعالم.", voice, tmp_path / "arabic.wav", RenderOptions()
    )
    # Synthetic graph: exercises the real Arabic frontend, not speech quality.
    assert result.duration_seconds == pytest.approx(1.0)


def test_cancel_keeps_previous_file_and_cleans_temporary(tmp_path, voice_spec):
    path = tmp_path / "existing.wav"
    path.write_bytes(b"original audio")
    cancel = Event()

    def on_progress(value):
        if value > 0:
            cancel.set()

    with pytest.raises(Cancelled):
        SpeechEngine().render("Hello.", voice_spec, path, RenderOptions(), cancel, on_progress)
    assert path.read_bytes() == b"original audio"
    assert not list(tmp_path.glob(".nova-voice-*"))


def test_pre_cancel_does_not_load_model(tmp_path, voice_spec, monkeypatch):
    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", lambda _: pytest.fail("Should not load model"))
    event = Event()
    event.set()
    with pytest.raises(Cancelled):
        engine.render("Hello", voice_spec, tmp_path / "new.wav", RenderOptions(), event)
    assert not (tmp_path / "new.wav").exists()


def test_failed_inference_preserves_existing_output(tmp_path, voice_spec, monkeypatch):
    engine = SpeechEngine()

    def failing_synthesize(*args, **kwargs):
        raise RuntimeError("Test inference failure")

    fake = SimpleNamespace(
        config=SimpleNamespace(sample_rate=22050, length_scale=1.0),
        synthesize=failing_synthesize,
    )
    monkeypatch.setattr(engine, "_load", lambda _: fake)
    path = tmp_path / "existing.mp3"
    path.write_bytes(b"keep this")
    with pytest.raises(RuntimeError, match="Test inference failure"):
        engine.render("Hello", voice_spec, path, RenderOptions())
    assert path.read_bytes() == b"keep this"
    assert not list(tmp_path.glob(".nova-voice-*"))


def test_speed_scales_model_default(tmp_path, voice_spec, monkeypatch):
    engine = SpeechEngine()
    captured = []

    def synthesize(text, syn_config):
        captured.append(syn_config)
        yield SimpleNamespace(
            sample_rate=22050, sample_width=2, sample_channels=1, audio_int16_bytes=bytes(4410)
        )

    monkeypatch.setattr(
        engine,
        "_load",
        lambda _: SimpleNamespace(
            config=SimpleNamespace(sample_rate=22050, length_scale=1.2),
            synthesize=synthesize,
        ),
    )
    engine.render("Hello", voice_spec, tmp_path / "speed.wav", RenderOptions(speed=1.5))
    assert captured[0].length_scale == pytest.approx(0.8)


@pytest.mark.parametrize(
    "options",
    [
        RenderOptions(speed=0.1),
        RenderOptions(pause_ms=-1),
        RenderOptions(speaker_id=99999),
    ],
)
def test_invalid_options_do_not_write(tmp_path, voice_spec, options):
    with pytest.raises(AudioError):
        SpeechEngine().render("Hello", voice_spec, tmp_path / "no.wav", options)
    assert not (tmp_path / "no.wav").exists()


def test_rejects_unsupported_format(tmp_path, voice_spec):
    with pytest.raises(AudioError, match="MP3"):
        SpeechEngine().render("Hello", voice_spec, tmp_path / "no.aac", RenderOptions())
