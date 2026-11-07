import numpy as np
import pytest

from nova_voice.pcm import resample_pcm16


def test_matching_rate_is_bit_exact_and_empty_input_stays_empty():
    pcm = np.array([-32768, 0, 32767], dtype="<i2").tobytes()
    assert resample_pcm16(pcm, 22050, 22050) == pcm
    assert resample_pcm16(b"", 22050, 24000) == b""


@pytest.mark.parametrize("source,target", [(22050, 24000), (24000, 22050), (48000, 16000)])
def test_resampling_preserves_duration_and_tone_pitch(source, target):
    time = np.arange(source) / source
    pcm = (10000 * np.sin(2 * np.pi * 440 * time)).astype("<i2").tobytes()
    converted = np.frombuffer(resample_pcm16(pcm, source, target), dtype="<i2")
    assert len(converted) == target  # one second before and after, not a header-only change
    frequencies = np.fft.rfftfreq(len(converted), d=1 / target)
    peak = frequencies[np.argmax(abs(np.fft.rfft(converted)))]
    assert peak == pytest.approx(440, abs=1)


def test_invalid_pcm_and_rates_are_rejected():
    with pytest.raises(ValueError):
        resample_pcm16(b"a", 22050, 24000)
    with pytest.raises(ValueError):
        resample_pcm16(bytes(10), 0, 24000)
