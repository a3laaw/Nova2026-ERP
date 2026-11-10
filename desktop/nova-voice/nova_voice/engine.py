"""Streaming local/optional consented Azure synthesis with atomic WAV/MP3 output."""

import os
import tempfile
import wave
from collections import OrderedDict
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, replace
from pathlib import Path
from threading import Event, Lock
from typing import Any

from .azure_speech import AzureError, AzureJob, AzureVoice, CloudRequest
from .dialogue import DialogueTurn, has_voice_markers, merge_turns, parse_dialogue
from .language import narration_text, validate_spoken_language
from .pcm import resample_pcm16
from .text import ScriptError, split_text, validate_text
from .timing import ClipTiming, LineTiming
from .voices import VoiceError, VoiceSpec, check_cancelled


class AudioError(ValueError):
    """A user-correctable audio/output problem."""


@dataclass(frozen=True)
class RenderOptions:
    speed: float = 1.0
    pause_ms: int = 250
    speaker_id: int = 0

    def validate(self, voice: VoiceSpec | AzureVoice) -> None:
        if not 0.6 <= self.speed <= 1.6:
            raise AudioError("اختر سرعة بين 0.60 و1.60.")
        if not 0 <= self.pause_ms <= 1500:
            raise AudioError("فاصل الفقرات يجب أن يكون بين 0 و1500 ملّي ثانية.")
        if not 0 <= self.speaker_id < voice.num_speakers:
            raise AudioError("المتحدث المحدد غير موجود في هذا النموذج.")


@dataclass(frozen=True)
class DialogueVoice:
    voice: VoiceSpec | AzureVoice
    speaker_id: int = 0


@dataclass(frozen=True)
class RenderResult:
    path: Path
    duration_seconds: float
    characters: int
    timing: ClipTiming | None = None


@dataclass(frozen=True)
class SpeechLine:
    """One logical saved row, identified BEFORE bounded TTS segmentation.

    Explicit trailing silence belongs outside the line's speech span. Wrapped
    same-role rows normally request zero silence. No path/model data is serialized.
    """

    line_id: int
    text: str
    speaker: int = 1
    pause_after_ms: int = 0


@dataclass(frozen=True)
class _SpeechBlock:
    text: str
    voice: VoiceSpec | AzureVoice
    options: RenderOptions
    pause_after_ms: int
    line_id: int | None = None
    speaker: int = 1


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

        def identity(voice):
            return (
                ("azure", voice.voice_id)
                if isinstance(voice, AzureVoice)
                else ("piper", voice.model_path)
            )

        if (identity(first.voice), first.speaker_id) == (identity(second.voice), second.speaker_id):
            raise VoiceError(
                "الصوتان يستخدمان النموذج والمتحدث نفسيهما. اختر نموذجًا آخر للصوت الثاني، "
                "أو متحدثًا مختلفًا داخل نموذج متعدد المتحدثين."
            )
    for turn in turns:
        validate_spoken_language(turn.text, cast[turn.speaker].voice.language_family, turn.speaker)


class SpeechEngine:
    """At most two cached models; one serialized job prevents eSpeak/encoder races."""

    def __init__(self, *, azure_job: AzureJob | None = None) -> None:
        self._azure_job = azure_job
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
        voice: VoiceSpec | AzureVoice,
        destination: Path,
        options: RenderOptions,
        cancel: Event | None = None,
        progress: Callable[[int], None] | None = None,
    ) -> RenderResult:
        blocks = self._single_blocks(text, voice, options)
        self.preflight_cloud(self.cloud_requests(blocks), complete=True)
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
        blocks = self._dialogue_blocks(script, cast, options, turn_pause_ms=turn_pause_ms)
        self.preflight_cloud(self.cloud_requests(blocks), complete=True)
        return self._render(blocks, destination, cancel, progress)

    def render_lines(
        self,
        lines: Sequence[SpeechLine],
        cast: Mapping[int, DialogueVoice],
        destination: Path,
        options: RenderOptions,
        cancel: Event | None = None,
        progress: Callable[[int], None] | None = None,
    ) -> RenderResult:
        return self._render(self._line_blocks(lines, cast, options), destination, cancel, progress)

    def preflight_cloud(
        self, requests: tuple[CloudRequest, ...], *, complete: bool = False
    ) -> None:
        if requests:
            if self._azure_job is None:
                raise AzureError("محرك Azure يحتاج مراجعة وإذنًا جديدين قبل هذه العملية.")
            self._azure_job.preflight(requests, complete=complete)

    @staticmethod
    def cloud_requests(blocks: Sequence[_SpeechBlock]) -> tuple[CloudRequest, ...]:
        return tuple(
            CloudRequest(block.voice, block.text, block.options.speed)
            for block in blocks
            if isinstance(block.voice, AzureVoice)
        )

    def script_cloud_requests(
        self,
        text: str,
        cast: Mapping[int, DialogueVoice],
        options: RenderOptions,
        *,
        dialogue: bool = False,
        turn_pause_ms: int = 350,
    ) -> tuple[CloudRequest, ...]:
        blocks = (
            self._dialogue_blocks(text, cast, options, turn_pause_ms=turn_pause_ms)
            if dialogue
            else self._single_blocks(text, cast[1].voice, options)
        )
        return self.cloud_requests(blocks)

    def line_cloud_requests(
        self,
        lines: Sequence[SpeechLine],
        cast: Mapping[int, DialogueVoice],
        options: RenderOptions,
    ) -> tuple[CloudRequest, ...]:
        return self.cloud_requests(self._line_blocks(lines, cast, options))

    def _single_blocks(
        self, text: str, voice: VoiceSpec | AzureVoice, options: RenderOptions
    ) -> list[_SpeechBlock]:
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
        return blocks

    def _dialogue_blocks(
        self,
        script: str,
        cast: Mapping[int, DialogueVoice],
        options: RenderOptions,
        *,
        turn_pause_ms: int = 350,
    ) -> list[_SpeechBlock]:
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
        return blocks

    def _line_blocks(
        self, lines: Sequence[SpeechLine], cast: Mapping[int, DialogueVoice], options: RenderOptions
    ) -> list[_SpeechBlock]:
        """Count each logical row in ONE sequential PCM/encoder stream.

        This opt-in API leaves render/render_dialogue callers and their existing
        segmentation unchanged. Every bounded piece retains its original ID;
        no line audio files, concatenation, alignment model or extra reply gaps.
        Internal paragraph pauses remain inside a row span. Explicit trailing
        pauses are separate, measured gaps, omitted after the very last row.
        """
        lines = tuple(lines)
        if not lines or any(
            not isinstance(line, SpeechLine)
            or type(line.line_id) is not int
            or line.line_id != index
            or not isinstance(line.text, str)
            or type(line.speaker) is not int
            or line.speaker not in (1, 2)
            or type(line.pause_after_ms) is not int
            or not 0 <= line.pause_after_ms <= 2000
            for index, line in enumerate(lines)
        ):
            raise AudioError("سطور التوقيت تحتاج معرّفات متتابعة وأدوارًا وفواصل صالحة.")
        validate_text("\n".join(line.text for line in lines))
        validate_dialogue_cast(
            [DialogueTurn(line.speaker, line.text) for line in lines], cast, options
        )
        blocks: list[_SpeechBlock] = []
        for line in lines:
            assignment = cast[line.speaker]
            pieces = split_text(narration_text(line.text))
            line_options = replace(options, speaker_id=assignment.speaker_id)
            for index, piece in enumerate(pieces):
                pause = options.pause_ms if piece.paragraph_end else 0
                if index == len(pieces) - 1:
                    pause = line.pause_after_ms
                blocks.append(
                    _SpeechBlock(
                        piece.text,
                        assignment.voice,
                        line_options,
                        pause,
                        line.line_id,
                        line.speaker,
                    )
                )
        return blocks

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
        check_cancelled(cancel)
        progress(-1)
        self.preflight_cloud(self.cloud_requests(blocks))
        loaded: dict[VoiceSpec | AzureVoice, Any] = {}
        # Preflight both voices before opening a temporary output file.
        for block in blocks:
            if block.voice not in loaded:
                check_cancelled(cancel)
                loaded[block.voice] = (
                    None if isinstance(block.voice, AzureVoice) else self._load(block.voice)
                )
                check_cancelled(cancel)
        rate = max(
            spec.sample_rate if isinstance(spec, AzureVoice) else voice.config.sample_rate
            for spec, voice in loaded.items()
        )
        destination = destination.expanduser().absolute()
        destination.parent.mkdir(parents=True, exist_ok=True)
        fd, name = tempfile.mkstemp(prefix=".nova-voice-", dir=destination.parent)
        temporary = Path(name)
        frames = 0
        completed = 0
        total = sum(len(block.text) for block in blocks)
        encoder = None
        wav = None
        line_timings: list[LineTiming] = []
        line_start = 0
        timing = None
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
                        if block.line_id is not None and (
                            index == 0 or blocks[index - 1].line_id != block.line_id
                        ):
                            line_start = frames
                        voice = loaded[block.voice]
                        if isinstance(block.voice, AzureVoice):
                            chunks = self._azure_job.synthesize(
                                CloudRequest(block.voice, block.text, block.options.speed), cancel
                            )
                            expected_rate = block.voice.sample_rate
                        else:
                            from piper import SynthesisConfig

                            synthesis = SynthesisConfig(
                                length_scale=voice.config.length_scale / block.options.speed,
                                speaker_id=block.options.speaker_id,
                            )
                            chunks = voice.synthesize(block.text, syn_config=synthesis)
                            expected_rate = voice.config.sample_rate
                        speech_frames = 0
                        for chunk in chunks:
                            check_cancelled(cancel)
                            if (chunk.sample_rate, chunk.sample_width, chunk.sample_channels) != (
                                expected_rate,
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
                        speech_end = frames
                        gap_frames = 0
                        if block.pause_after_ms and index < len(blocks) - 1:
                            gap_frames = round(rate * block.pause_after_ms / 1000)
                            write_pcm(bytes(gap_frames * 2))
                        if block.line_id is not None and (
                            index + 1 == len(blocks) or blocks[index + 1].line_id != block.line_id
                        ):
                            line_timings.append(
                                LineTiming(
                                    block.line_id, block.speaker, line_start, speech_end, gap_frames
                                )
                            )
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
            if line_timings:
                timing = ClipTiming(
                    rate, frames, tuple(line_timings), destination.suffix.lower()[1:]
                )
                # Validate before publishing either audio or its metadata.
                ClipTiming.from_data(timing.to_data(), tuple(line.speaker for line in line_timings))
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)
        progress(100)
        return RenderResult(destination, frames / rate, total, timing)
