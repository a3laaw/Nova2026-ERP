import json
import wave
from dataclasses import replace
from threading import Event
from types import SimpleNamespace

import numpy as np
import pytest

from nova_voice.dialogue import parse_dialogue
from nova_voice.engine import (
    AudioError,
    DialogueVoice,
    RenderOptions,
    SpeechEngine,
    validate_dialogue_cast,
)
from nova_voice.voices import Cancelled, VoiceError

SCRIPT = "[1] مرحبا بالعالم.\n[2] Hello world.\n[1] شكرًا لك."


def test_real_arabic_and_english_models_share_one_wav_stream(tmp_path, bilingual_cast):
    result = SpeechEngine().render_dialogue(
        SCRIPT,
        bilingual_cast,
        tmp_path / "dialogue.wav",
        RenderOptions(),
        turn_pause_ms=400,
    )
    with wave.open(str(result.path), "rb") as audio:
        assert audio.getnchannels() == 1
        assert audio.getframerate() == 22050
        assert audio.getnframes() / 22050 == pytest.approx(3.8, abs=0.001)
    assert result.duration_seconds == pytest.approx(3.8, abs=0.001)
    assert result.characters == sum(len(turn.text) for turn in parse_dialogue(SCRIPT))


def test_real_dialogue_encodes_as_one_mp3(tmp_path, bilingual_cast):
    result = SpeechEngine().render_dialogue(
        SCRIPT,
        bilingual_cast,
        tmp_path / "dialogue.mp3",
        RenderOptions(),
    )
    data = result.path.read_bytes()
    assert data[0] == 0xFF and data[1] & 0xE0 == 0xE0
    assert len(data) > 1000


def test_each_voice_is_loaded_once_not_on_every_reply(tmp_path, bilingual_cast, monkeypatch):
    from piper import PiperVoice

    original = PiperVoice.load
    loads = []

    def load(*args, **kwargs):
        loads.append(args[0])
        return original(*args, **kwargs)

    monkeypatch.setattr(PiperVoice, "load", load)
    engine = SpeechEngine()
    script = "\n".join(["[1] Hello.", "[2] Reply."] * 6)
    engine.render_dialogue(script, bilingual_cast, tmp_path / "first.wav", RenderOptions())
    engine.render_dialogue(script, bilingual_cast, tmp_path / "second.wav", RenderOptions())
    assert len(loads) == 2
    assert len(engine._voices) == 2


def test_voice_order_and_different_sample_rates_do_not_shift_pitch_or_timing(
    tmp_path,
    bilingual_cast,
    monkeypatch,
):
    cast = dict(bilingual_cast)
    cast[2] = DialogueVoice(replace(cast[2].voice, sample_rate=24000))
    called = []

    def fake_voice(spec):
        role = 1 if spec == cast[1].voice else 2

        def synthesize(text, syn_config):
            called.append((role, text, syn_config.speaker_id))
            yield SimpleNamespace(
                sample_rate=spec.sample_rate,
                sample_width=2,
                sample_channels=1,
                audio_int16_bytes=np.full(spec.sample_rate, role * 1000, dtype="<i2").tobytes(),
            )

        return SimpleNamespace(
            config=SimpleNamespace(sample_rate=spec.sample_rate, length_scale=1.0),
            synthesize=synthesize,
        )

    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", fake_voice)
    result = engine.render_dialogue(
        SCRIPT,
        cast,
        tmp_path / "mixed.wav",
        RenderOptions(),
        turn_pause_ms=500,
    )
    assert [role for role, _, _ in called] == [1, 2, 1]
    assert all("[" not in text for _, text, _ in called)
    with wave.open(str(result.path), "rb") as audio:
        assert audio.getframerate() == 24000
        samples = np.frombuffer(audio.readframes(audio.getnframes()), dtype="<i2")
    assert result.duration_seconds == pytest.approx(4.0)
    assert [samples[index] for index in (12000, 48000, 84000)] == pytest.approx(
        [1000, 2000, 1000], abs=3
    )  # libsoxr dithers PCM16 quantization by roughly one sample unit.
    assert not samples[24000:36000].any()
    assert not samples[60000:72000].any()


def test_same_model_can_use_two_distinct_internal_speakers(tmp_path, voice_spec, monkeypatch):
    spec = replace(voice_spec, num_speakers=2)
    cast = {1: DialogueVoice(spec, 0), 2: DialogueVoice(spec, 1)}
    captured = []

    def synthesize(text, syn_config):
        captured.append(syn_config.speaker_id)
        yield SimpleNamespace(
            sample_rate=22050,
            sample_width=2,
            sample_channels=1,
            audio_int16_bytes=bytes(4410),
        )

    engine = SpeechEngine()
    monkeypatch.setattr(
        engine,
        "_load",
        lambda _: SimpleNamespace(
            config=SimpleNamespace(sample_rate=22050, length_scale=1.0),
            synthesize=synthesize,
        ),
    )
    engine.render_dialogue("[1] Hello.\n[2] Reply.", cast, tmp_path / "multi.wav", RenderOptions())
    assert captured == [0, 1]


def test_missing_or_identical_voice_selection_is_not_silently_used(tmp_path, bilingual_cast):
    path = tmp_path / "missing.wav"
    with pytest.raises(VoiceError, match="2"):
        SpeechEngine().render_dialogue(SCRIPT, {1: bilingual_cast[1]}, path, RenderOptions())
    same = {1: bilingual_cast[1], 2: bilingual_cast[1]}
    with pytest.raises(VoiceError, match="نفسيهما"):
        SpeechEngine().render_dialogue(SCRIPT, same, path, RenderOptions())
    assert not path.exists()


def test_only_referenced_speaker_needs_to_be_installed(tmp_path, bilingual_cast):
    cast = {2: bilingual_cast[2]}
    result = SpeechEngine().render_dialogue(
        "[2] A short reply.",
        cast,
        tmp_path / "one-turn.wav",
        RenderOptions(),
    )
    assert result.duration_seconds == pytest.approx(1.0)


def test_cancel_between_turns_preserves_existing_file(tmp_path, bilingual_cast):
    path = tmp_path / "existing.wav"
    path.write_bytes(b"preserved")
    cancel = Event()

    def progress(value):
        if value > 0:
            cancel.set()

    with pytest.raises(Cancelled):
        SpeechEngine().render_dialogue(
            SCRIPT, bilingual_cast, path, RenderOptions(), cancel, progress
        )
    assert path.read_bytes() == b"preserved"
    assert not list(tmp_path.glob(".nova-voice-*"))


def test_second_voice_failure_cannot_publish_partial_dialogue(
    tmp_path, bilingual_cast, monkeypatch
):
    engine = SpeechEngine()

    def fake_voice(spec):
        def synthesize(*args, **kwargs):
            if spec == bilingual_cast[2].voice:
                raise RuntimeError("second speaker failed")
            yield SimpleNamespace(
                sample_rate=22050,
                sample_width=2,
                sample_channels=1,
                audio_int16_bytes=bytes(4410),
            )

        return SimpleNamespace(
            config=SimpleNamespace(sample_rate=22050, length_scale=1.0),
            synthesize=synthesize,
        )

    monkeypatch.setattr(engine, "_load", fake_voice)
    path = tmp_path / "existing.mp3"
    path.write_bytes(b"original")
    with pytest.raises(RuntimeError, match="second speaker failed"):
        engine.render_dialogue(SCRIPT, bilingual_cast, path, RenderOptions())
    assert path.read_bytes() == b"original"
    assert not list(tmp_path.glob(".nova-voice-*"))


def test_invalid_turn_pause_and_speaker_are_rejected_before_writing(tmp_path, bilingual_cast):
    path = tmp_path / "no.wav"
    with pytest.raises(AudioError):
        SpeechEngine().render_dialogue(
            SCRIPT,
            bilingual_cast,
            path,
            RenderOptions(),
            turn_pause_ms=3000,
        )
    cast = dict(bilingual_cast)
    cast[2] = replace(cast[2], speaker_id=999)
    with pytest.raises(AudioError):
        validate_dialogue_cast(parse_dialogue(SCRIPT), cast, RenderOptions())
    assert not path.exists()


def test_changed_model_metadata_requires_refresh(bilingual_cast):
    engine = SpeechEngine()
    spec = bilingual_cast[1].voice
    data = json.loads(spec.config_path.read_text())
    data["audio"]["sample_rate"] = 24000
    spec.config_path.write_text(json.dumps(data))
    with pytest.raises(VoiceError, match="تحديث"):
        engine._load(spec)


def test_model_cache_never_grows_beyond_two_models(tmp_path, bilingual_cast):
    import shutil

    from nova_voice.voices import VoiceSpec

    engine = SpeechEngine()
    for assignment in bilingual_cast.values():
        engine._load(assignment.voice)
    original = bilingual_cast[2].voice
    third = tmp_path / "third.onnx"
    shutil.copyfile(original.model_path, third)
    shutil.copyfile(original.config_path, tmp_path / "third.onnx.json")
    engine._load(VoiceSpec.from_path(third))
    assert len(engine._voices) == 2
    assert {key[0] for key in engine._voices} == {str(original.model_path), str(third)}
