"""Offline, streaming single-voice/dialogue synthesis with atomic WAV/MP3 output."""

import os
import tempfile
import wave
from collections import OrderedDict
from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from pathlib import Path
from threading import Event, Lock
from typing import Any

from .dialogue import DialogueTurn, has_voice_markers, merge_turns, parse_dialogue
from .language import narration_text, validate_spoken_language
from .pcm import resample_pcm16
from .text import ScriptError, split_text, validate_text
from .voices import VoiceError, VoiceSpec, check_cancelled


class AudioError(ValueError):
    """A user-correctable audio/output problem."""


@dataclass(frozen=True)
class RenderOptions:
    speed: float = 1.0
    pause_ms: int = 250
    speaker_id: int = 0

    def validate(self, voice: VoiceSpec) -> None:
        if not 0.6 <= self.speed <= 1.6:
            raise AudioError("اختر سرعة بين 0.60 و1.60.")
        if not 0 <= self.pause_ms <= 1500:
            raise AudioError("فاصل الفقرات يجب أن يكون بين 0 و1500 ملّي ثانية.")
        if not 0 <= self.speaker_id < voice.num_speakers:
            raise AudioError("المتحدث المحدد غير موجود في هذا النموذج.")


@dataclass(frozen=True)
class DialogueVoice:
    voice: VoiceSpec
    speaker_id: int = 0


@dataclass(frozen=True)
class RenderResult:
    path: Path
    duration_seconds: float
    characters: int


@dataclass(frozen=True)
class _SpeechBlock:
    text: str
    voice: VoiceSpec
    options: RenderOptions
    pause_after_ms: int


def validate_dialogue_cast(
    turns: list[DialogueTurn], cast: Mapping[int, DialogueVoice], options: RenderOptions
) -> None:
    used = {turn.speaker for turn in turns}
    for role in used:
        if role not in cast:
            raise VoiceError(f"اختر نموذجًا للصوت {role} المستخدم في السكريبت.")
        assignment = cast[role]
        replace(options, speaker_id=assignment.speaker_id).validate(assignment.voice)
    if used == {1, 2}:
        first, second = cast[1], cast[2]
        if (first.voice.model_path, first.speaker_id) == (
            second.voice.model_path,
            second.speaker_id,
        ):
            raise VoiceError(
                "الصوتان يستخدمان النموذج والمتحدث نفسيهما. اختر نموذجًا آخر للصوت الثاني، "
                "أو متحدثًا مختلفًا داخل نموذج متعدد المتحدثين."
            )
    for turn in turns:
        validate_spoken_language(turn.text, cast[turn.speaker].voice.language_family, turn.speaker)


class SpeechEngine:
    """At most two cached models; one serialized job prevents eSpeak/encoder races."""

    def __init__(self) -> None:
        self._voices: OrderedDict[tuple[Any, ...], Any] = OrderedDict()
        self._lock = Lock()

    def _load(self, spec: VoiceSpec) -> Any:
        current = VoiceSpec.from_path(spec.model_path, spec.config_path)
        if (current.sample_rate, current.num_speakers, current.language_family) != (
            spec.sample_rate,
            spec.num_speakers,
            spec.language_family,
        ):
            raise VoiceError("تغيّرت إعدادات النموذج. اضغط «تحديث» ثم اختر الصوت مجددًا.")
        key = (
            str(spec.model_path),
            spec.model_path.stat().st_mtime_ns,
            str(spec.config_path),
            spec.config_path.stat().st_mtime_ns,
        )
        if key in self._voices:
            self._voices.move_to_end(key)
            return self._voices[key]
        # Drop obsolete versions and evict BEFORE allocating a third model.
        for cached in list(self._voices):
            if cached[0] == key[0]:
                del self._voices[cached]
        while len(self._voices) >= 2:
            self._voices.popitem(last=False)
        import onnxruntime
        from piper import PiperVoice

        onnxruntime.disable_telemetry_events()
        try:
            voice = PiperVoice.load(
                str(spec.model_path), config_path=str(spec.config_path), use_cuda=False
            )
        except Exception as error:
            raise VoiceError(
                "تعذّر تحميل النموذج. تأكد من سلامة ملف ONNX وتطابقه مع ملف JSON."
            ) from error
        self._voices[key] = voice
        return voice

    def render(
        self,
        text: str,
        voice: VoiceSpec,
        destination: Path,
        options: RenderOptions,
        cancel: Event | None = None,
        progress: Callable[[int], None] | None = None,
    ) -> RenderResult:
        if has_voice_markers(text):
            raise ScriptError(
                "السكريبت يحتوي وسوم أصوات. اختر «حوار بين صوتين» حتى لا تُقرأ الوسوم."
            )
        text = validate_text(text)
        options.validate(voice)
        validate_spoken_language(text, voice.language_family)
        text = narration_text(text)
        blocks = [
            _SpeechBlock(block.text, voice, options, options.pause_ms if block.paragraph_end else 0)
            for block in split_text(text)
        ]
        return self._render(blocks, destination, cancel, progress)

    def render_dialogue(
        self,
        script: str,
        cast: Mapping[int, DialogueVoice],
        destination: Path,
        options: RenderOptions,
        cancel: Event | None = None,
        progress: Callable[[int], None] | None = None,
        *,
        turn_pause_ms: int = 350,
    ) -> RenderResult:
        """Render turns in source order into ONE encoder, never overlapping tracks.

        A cast entry's speaker_id overrides the single-narrator options.speaker_id.
        Each turn uses its model's language; there is no automatic translation or
        language guessing. Different model sample rates are resampled, not relabeled.
        """
        turns = parse_dialogue(script)
        validate_dialogue_cast(turns, cast, options)
        turns = merge_turns(
            [DialogueTurn(turn.speaker, narration_text(turn.text)) for turn in turns]
        )
        if not 0 <= turn_pause_ms <= 2000:
            raise AudioError("فاصل الردود يجب أن يكون بين 0 و2000 ملّي ثانية.")
        blocks: list[_SpeechBlock] = []
        for turn in turns:
            assignment = cast[turn.speaker]
            turn_options = replace(options, speaker_id=assignment.speaker_id)
            pieces = split_text(turn.text)
            for index, piece in enumerate(pieces):
                pause = options.pause_ms if piece.paragraph_end else 0
                if index == len(pieces) - 1:
                    pause = turn_pause_ms
                blocks.append(_SpeechBlock(piece.text, assignment.voice, turn_options, pause))
        return self._render(blocks, destination, cancel, progress)

    def _render(
        self,
        blocks: list[_SpeechBlock],
        destination: Path,
        cancel: Event | None,
        progress: Callable[[int], None] | None,
    ) -> RenderResult:
        cancel = cancel if cancel is not None else Event()
        progress = progress or (lambda value: None)
        if destination.suffix.lower() not in (".wav", ".mp3"):
            raise AudioError("اختر ملفًا بامتداد WAV أو MP3.")
        check_cancelled(cancel)
        while not self._lock.acquire(timeout=0.1):
            check_cancelled(cancel)
        try:
            return self._render_locked(blocks, destination, cancel, progress)
        finally:
            self._lock.release()

    def _render_locked(
        self,
        blocks: list[_SpeechBlock],
        destination: Path,
        cancel: Event,
        progress: Callable[[int], None],
    ) -> RenderResult:
        from piper import SynthesisConfig

        check_cancelled(cancel)
        progress(-1)
        loaded: dict[VoiceSpec, Any] = {}
        # Preflight both voices before opening a temporary output file.
        for block in blocks:
            if block.voice not in loaded:
                check_cancelled(cancel)
                loaded[block.voice] = self._load(block.voice)
                check_cancelled(cancel)
        rate = max(voice.config.sample_rate for voice in loaded.values())
        destination = destination.expanduser().absolute()
        destination.parent.mkdir(parents=True, exist_ok=True)
        fd, name = tempfile.mkstemp(prefix=".nova-voice-", dir=destination.parent)
        temporary = Path(name)
        frames = 0
        completed = 0
        total = sum(len(block.text) for block in blocks)
        encoder = None
        wav = None
        try:
            with os.fdopen(fd, "wb") as handle:
                progress(0)
                try:
                    if destination.suffix.lower() == ".wav":
                        wav = wave.open(handle, "wb")
                        wav.setnchannels(1)
                        wav.setsampwidth(2)
                        wav.setframerate(rate)
                    else:
                        import lameenc

                        encoder = lameenc.Encoder()
                        encoder.set_bit_rate(192)
                        encoder.set_in_sample_rate(rate)
                        encoder.set_channels(1)
                        encoder.set_quality(2)
                        encoder.silence()

                    def write_pcm(pcm: bytes) -> None:
                        nonlocal frames
                        if len(pcm) % 2:
                            raise AudioError("أعاد المحرك بيانات صوتية غير صالحة.")
                        frames += len(pcm) // 2
                        if wav is not None:
                            wav.writeframesraw(pcm)
                        else:
                            handle.write(encoder.encode(pcm))

                    for index, block in enumerate(blocks):
                        check_cancelled(cancel)
                        voice = loaded[block.voice]
                        synthesis = SynthesisConfig(
                            length_scale=voice.config.length_scale / block.options.speed,
                            speaker_id=block.options.speaker_id,
                        )
                        speech_frames = 0
                        for chunk in voice.synthesize(block.text, syn_config=synthesis):
                            check_cancelled(cancel)
                            if (chunk.sample_rate, chunk.sample_width, chunk.sample_channels) != (
                                voice.config.sample_rate,
                                2,
                                1,
                            ):
                                raise AudioError("تنسيق الصوت الصادر من النموذج غير متوافق.")
                            try:
                                pcm = resample_pcm16(
                                    chunk.audio_int16_bytes, chunk.sample_rate, rate
                                )
                            except ValueError as error:
                                raise AudioError("أعاد المحرك بيانات صوتية غير صالحة.") from error
                            speech_frames += len(pcm) // 2
                            write_pcm(pcm)
                        if not speech_frames:
                            raise AudioError("لم ينتج أحد المقاطع أي صوت. جرّب نصًا أو نموذجًا آخر.")
                        if block.pause_after_ms and index < len(blocks) - 1:
                            write_pcm(bytes(round(rate * block.pause_after_ms / 1000) * 2))
                        completed += len(block.text)
                        progress(min(99, round(100 * completed / total)))
                    check_cancelled(cancel)
                    if encoder is not None:
                        handle.write(encoder.flush())
                finally:
                    if wav is not None:
                        wav.close()
                handle.flush()
                os.fsync(handle.fileno())
            check_cancelled(cancel)
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)
        progress(100)
        return RenderResult(destination, frames / rate, total)
