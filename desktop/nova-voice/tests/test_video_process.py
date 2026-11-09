"""Opt-in real encoder cancellation/limit QA; patterns only, no voice/model claims."""

import os
import subprocess
from pathlib import Path
from threading import Event, Timer

import pytest

from nova_voice import video
from nova_voice.voices import Cancelled

FFMPEG = os.environ.get("NOVA_FFMPEG")
pytestmark = pytest.mark.skipif(not FFMPEG, reason="Supply local NOVA_FFMPEG explicitly")


@pytest.fixture
def source(tmp_path):
    path = tmp_path / "input.webm"
    subprocess.run(
        [
            FFMPEG,
            "-nostdin",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=0xDBEAFE:s=640x360:r=20:d=1.2",
            "-c:v",
            "libvpx-vp9",
            "-threads",
            "2",
            str(path),
        ],
        check=True,
        capture_output=True,
        timeout=30,
    )
    return path


def test_real_cancellation_reaps_encoder_and_preserves_old_file(source, tmp_path, monkeypatch):
    target = tmp_path / "previous.mp4"
    target.write_bytes(b"keep previous")
    cancel, processes, timers = Event(), [], []
    original = subprocess.Popen

    def start(*args, **kwargs):
        process = original(*args, **kwargs)
        processes.append(process)
        timer = Timer(0.001, cancel.set)
        timers.append(timer)
        timer.start()
        return process

    monkeypatch.setattr(video.subprocess, "Popen", start)
    try:
        with pytest.raises(Cancelled):
            video.convert_video(source, target, Path(FFMPEG), cancel, reviewed=True, overwrite=True)
    finally:
        for timer in timers:
            timer.join()
    assert processes and all(p.poll() is not None for p in processes)
    assert target.read_bytes() == b"keep previous"
    assert not list(tmp_path.glob(".nova-video-*"))


def test_real_duration_limit_is_rejected_not_silently_truncated(source, tmp_path, monkeypatch):
    target = tmp_path / "previous.mp4"
    target.write_bytes(b"keep previous")
    monkeypatch.setattr(video, "MAX_SECONDS", 0.5)
    with pytest.raises(video.VideoError):
        video.convert_video(source, target, Path(FFMPEG), reviewed=True, overwrite=True)
    assert target.read_bytes() == b"keep previous"
    assert not list(tmp_path.glob(".nova-video-*"))
