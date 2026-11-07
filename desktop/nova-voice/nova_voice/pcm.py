"""Local PCM conversion for a single audio stream from different voice sample rates."""


def resample_pcm16(pcm: bytes, source_rate: int, target_rate: int) -> bytes:
    """Resample mono, little-endian signed PCM16 without altering speech pitch.

    A bounded Piper sentence is processed at a time; the whole script is never
    buffered. libsoxr's HQ anti-aliasing is used instead of changing WAV headers or
    naive sample dropping. The Python/ONNX audio pipeline runs on Windows x64.
    """
    if len(pcm) % 2:
        raise ValueError("PCM16 requires complete two-byte samples")
    if not 8000 <= source_rate <= 48000 or not 8000 <= target_rate <= 48000:
        raise ValueError("Unsupported sample rate")
    if source_rate == target_rate or not pcm:
        return pcm
    import numpy as np
    import soxr

    samples = np.frombuffer(pcm, dtype="<i2")
    converted = soxr.resample(samples, source_rate, target_rate, quality="HQ")
    return converted.astype("<i2", copy=False).tobytes()
