"""Measure the real streaming writer's MP3 offset against known PCM, locally.

Development-only miniaudio decodes the output; neither the desktop app nor HTML
imports it. This is a codec measurement, NOT a Piper natural-speech evaluation.
No measured constant is applied to browser playback: decoder trimming can differ.
"""

import argparse
import json
import platform
import sys
import tempfile
import wave
from dataclasses import replace
from importlib.metadata import version
from pathlib import Path
from types import SimpleNamespace

# Also runnable from an uninstalled, extracted NovaVoice-Source checkout.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from nova_voice.engine import DialogueVoice, RenderOptions, SpeechEngine, SpeechLine  # noqa: E402
from nova_voice.voices import VoiceSpec  # noqa: E402

RATES = (8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000)


def measure_rate(rate: int, folder: Path) -> dict:
    import miniaudio  # Test/development dependency only, not the application runtime.

    rng = np.random.default_rng(20261107)
    signal = np.zeros(rate, dtype="<i2")
    start, end = rate // 10, rate * 8 // 10
    signal[start:end] = rng.integers(-11000, 11000, size=end - start, dtype=np.int16)
    fixture = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "test_voice.onnx"
    spec = replace(VoiceSpec.from_path(fixture), sample_rate=rate)

    class SignalEngine(SpeechEngine):
        def _load(self, _):
            def synthesize(text, syn_config):
                yield SimpleNamespace(
                    sample_rate=rate,
                    sample_width=2,
                    sample_channels=1,
                    audio_int16_bytes=signal.tobytes(),
                )

            return SimpleNamespace(
                config=SimpleNamespace(sample_rate=rate, length_scale=1.0), synthesize=synthesize
            )

    engine = SignalEngine()
    results = {}
    for extension in ("wav", "mp3"):
        results[extension] = engine.render_lines(
            [SpeechLine(0, "Calibration.")],
            {1: DialogueVoice(spec)},
            folder / f"calibration-{rate}.{extension}",
            RenderOptions(),
        )
    with wave.open(str(results["wav"].path), "rb") as audio:
        reference = np.frombuffer(audio.readframes(audio.getnframes()), dtype="<i2").astype(float)
    decoded = miniaudio.decode(
        results["mp3"].path.read_bytes(),
        nchannels=1,
        sample_rate=rate,
        output_format=miniaudio.SampleFormat.SIGNED16,
        dither=miniaudio.DitherMode.NONE,
    )
    actual = np.array(decoded.samples, dtype=float)
    fft_size = 1 << (len(actual) + len(reference) - 1).bit_length()
    correlation = np.fft.irfft(
        np.fft.rfft(actual, fft_size) * np.conj(np.fft.rfft(reference, fft_size)), fft_size
    )
    delay = int(np.argmax(correlation[: len(actual)]))
    return {
        "sample_rate": rate,
        "pcm_samples": len(reference),
        "decoded_mp3_samples": len(actual),
        "measured_delay_samples": delay,
        "trailing_samples": len(actual) - len(reference) - delay,
        "delay_ms": round(1000 * delay / rate, 6),
        "wav_timing_samples": results["wav"].timing.total_samples,
        "mp3_timing_samples": results["mp3"].timing.total_samples,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Optional small JSON measurement report")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="nova-mp3-measurement-") as directory:
        measurements = [measure_rate(rate, Path(directory)) for rate in RATES]
    report = {
        "encoder": "lameenc " + version("lameenc"),
        "decoder": "miniaudio " + version("miniaudio"),
        "platform": platform.system(),
        "method": "FFT correlation: deterministic PCM noise versus decoded streaming MP3",
        "browser_delay_compensation": False,
        "measurements": measurements,
    }
    content = json.dumps(report, indent=2) + "\n"
    if args.output:
        args.output.write_text(content, encoding="utf-8")
    print(content, end="")


if __name__ == "__main__":
    main()
