"""Converter safety/metadata unit tests; optional real FFmpeg integration below."""

import os
import struct
import subprocess
from pathlib import Path
from threading import Event

import pytest

from nova_voice import video
from nova_voice.video import VideoError, convert_video, inspect_mp4
from nova_voice.voices import Cancelled


def box(tag, data):
    return struct.pack(">I4s", len(data) + 8, tag) + data


def descriptor(tag, data):
    assert len(data) < 128
    return bytes([tag, len(data)]) + data


def movie(
    *,
    audio=True,
    codec=b"avc1",
    profile=77,
    level=31,
    duration=2,
    faststart=True,
    aac_type=2,
    width=1280,
    extra_track=False,
    remote=False,
):
    """Only a metadata contract fixture, NOT a decodable video or encoder proof."""
    duration_data = bytes(12) + struct.pack(">II", 1000, int(duration * 1000)) + bytes(4)

    def track(handler, entry):
        refs = box(
            b"dref",
            bytes(4)
            + struct.pack(">I", 1)
            + box(b"url ", b"\0\0\0\0https://invalid/" if remote else b"\0\0\0\1"),
        )
        table = box(b"stbl", box(b"stsd", bytes(4) + struct.pack(">I", 1) + entry))
        media = box(b"mdhd", duration_data) + box(b"hdlr", bytes(8) + handler)
        return box(b"trak", box(b"mdia", media + box(b"minf", box(b"dinf", refs) + table)))

    sample = bytearray(78)
    struct.pack_into(">HH", sample, 24, width, 720)
    sample += box(b"avcC", bytes([1, profile, 0, level]))
    tracks = track(b"vide", box(codec, bytes(sample)))
    if audio:
        config = descriptor(5, bytes([aac_type << 3, 0x10]))
        decoder = descriptor(4, bytes([0x40, 0x15]) + bytes(11) + config)
        esds = bytes(4) + descriptor(3, bytes(3) + decoder)
        tracks += track(b"soun", box(b"mp4a", bytes(28) + box(b"esds", esds)))
    if extra_track:
        tracks += track(b"text", box(b"text", bytes(8)))
    moov = box(b"moov", box(b"mvhd", duration_data) + tracks)
    media = box(b"mdat", bytes(40))
    return box(b"ftyp", b"isom\0\0\0\0isom") + (moov + media if faststart else media + moov)


@pytest.fixture
def files(tmp_path):
    source, encoder, target = (
        tmp_path / name
        for name in ("input.webm", "ffmpeg.exe" if os.name == "nt" else "ffmpeg", "result.mp4")
    )
    source.write_bytes(b"\x1aE\xdf\xa3" + bytes(30))
    encoder.write_text("trusted executable selected by the user in the unit test", encoding="utf-8")
    return source, target, encoder


@pytest.mark.parametrize("audio", [True, False])
def test_inspector_accepts_constrained_metadata_and_does_not_invent_audio(tmp_path, audio):
    path = tmp_path / "movie.mp4"
    path.write_bytes(movie(audio=audio))
    result = inspect_mp4(path)
    assert result.width == 1280 and result.height == 720
    assert result.has_audio is audio and result.duration_seconds == 2
    assert result.size_bytes == path.stat().st_size


@pytest.mark.parametrize(
    "options",
    [
        {"codec": b"vp09"},
        {"profile": 100},
        {"level": 51},
        {"duration": 901},
        {"duration": 0},
        {"width": 640},
        {"faststart": False},
        {"aac_type": 5},
        {"extra_track": True},
        {"remote": True},
    ],
)
def test_inspector_rejects_ambiguous_codecs_external_refs_profiles_and_limits(tmp_path, options):
    path = tmp_path / "movie.mp4"
    path.write_bytes(movie(**options))
    with pytest.raises(VideoError):
        inspect_mp4(path)


@pytest.mark.parametrize(
    "payload",
    [
        b"",
        b"not a video",
        b"\0\0\0\1moov",
        box(b"ftyp", bytes(8)),
        movie()[:-1],
        movie() + b"bad",
        b"\xff\xff\xff\xffftyp",
    ],
)
def test_inspector_refuses_truncated_and_oversized_metadata(tmp_path, payload):
    path = tmp_path / "bad.mp4"
    path.write_bytes(payload)
    with pytest.raises(VideoError):
        inspect_mp4(path)


def test_converter_stages_checks_decodes_and_publishes_only_after_success(files, monkeypatch):
    source, target, encoder = files
    calls, progress = [], []

    def run(command, cancel, log, *, output=None):
        calls.append(command)
        assert not target.exists()
        if output:
            output.write_bytes(movie())
        else:
            assert "-xerror" in command and command[-2:] == ["null", "-"]

    monkeypatch.setattr(video, "_run", run)
    result = convert_video(source, target, encoder, reviewed=True, progress=progress.append)
    assert result.path == target and result.has_audio
    assert target.read_bytes() == movie() and source.read_bytes().startswith(b"\x1aE\xdf\xa3")
    assert len(calls) == 2 and progress == [-1, 90, 99, 100]
    command = calls[0]
    assert command[0] == str(encoder) and "-nostdin" in command
    for flag, value in (
        ("-c:v", "libx264"),
        ("-c:a", "aac"),
        ("-pix_fmt", "yuv420p"),
        ("-movflags", "+faststart"),
        ("-protocol_whitelist", "file,pipe"),
        ("-f", "matroska"),
        ("-map_metadata", "-1"),
        ("-threads", "2"),
    ):
        assert command[command.index(flag) + 1] == value
    assert not list(target.parent.glob(".nova-video-*"))


def test_mov_input_is_forced_local_and_external_data_references_disabled(files, monkeypatch):
    source, target, encoder = files
    source = source.with_suffix(".mp4")
    source.write_bytes(movie())
    commands = []

    def run(command, cancel, log, *, output=None):
        commands.append(command)
        if output:
            output.write_bytes(movie(audio=False))

    monkeypatch.setattr(video, "_run", run)
    convert_video(source, target, encoder, reviewed=True)
    assert commands[0][commands[0].index("-f") + 1] == "mov"
    for command in commands:
        assert command[command.index("-enable_drefs") + 1] == "0"
        assert command[command.index("-use_absolute_path") + 1] == "0"


@pytest.mark.parametrize("reviewed", [False, None, 1, "yes"])
def test_unreviewed_conversion_never_runs_an_executable(files, monkeypatch, reviewed):
    monkeypatch.setattr(
        video.subprocess, "Popen", lambda *a, **k: pytest.fail("started executable")
    )
    with pytest.raises(VideoError, match="راجع"):
        convert_video(*files, reviewed=reviewed)


@pytest.mark.parametrize("problem", ["input", "suffix", "header", "encoder", "directory", "size"])
def test_bad_paths_containers_sizes_fail_before_execution(files, monkeypatch, problem):
    source, target, encoder = files
    monkeypatch.setattr(
        video.subprocess, "Popen", lambda *a, **k: pytest.fail("started executable")
    )
    if problem == "input":
        source.unlink()
    elif problem == "suffix":
        target = target.with_suffix(".webm")
    elif problem == "header":
        source.write_bytes(b"#EXTM3U\nhttps://invalid/video")
    elif problem == "encoder":
        encoder.unlink()
    elif problem == "directory":
        target = target / "out.mp4"
    else:
        monkeypatch.setattr(video, "MAX_BYTES", 5)
    with pytest.raises(VideoError):
        convert_video(source, target, encoder, reviewed=True)


def test_aliases_existing_output_and_race_cannot_overwrite_original(files, monkeypatch):
    source, target, encoder = files
    target.write_bytes(b"previous")
    with pytest.raises(VideoError):
        convert_video(source, target, encoder, reviewed=True)
    target.unlink()
    os.link(source, target)
    with pytest.raises(VideoError):
        convert_video(source, target, encoder, reviewed=True, overwrite=True)
    target.unlink()

    def run(command, cancel, log, *, output=None):
        if output:
            output.write_bytes(movie())
        else:
            target.write_bytes(b"created by another program during conversion")

    monkeypatch.setattr(video, "_run", run)
    with pytest.raises(FileExistsError):
        convert_video(source, target, encoder, reviewed=True)
    assert target.read_bytes() == b"created by another program during conversion"
    assert not list(target.parent.glob(".nova-video-*"))


@pytest.mark.parametrize("failure", ["encode", "metadata", "decode", "cancel", "source-change"])
def test_failed_or_cancelled_stages_preserve_existing_file_and_remove_temps(
    files, monkeypatch, failure
):
    source, target, encoder = files
    target.write_bytes(b"previous")
    cancel = Event()

    def run(command, event, log, *, output=None):
        if output:
            if failure == "encode":
                raise VideoError("encoding failed")
            output.write_bytes(movie(codec=b"vp09") if failure == "metadata" else movie())
        elif failure == "decode":
            raise VideoError("decoding failed")
        elif failure == "cancel":
            event.set()
        elif failure == "source-change":
            source.write_bytes(source.read_bytes() + b"changed")

    monkeypatch.setattr(video, "_run", run)
    with pytest.raises((VideoError, Cancelled)):
        convert_video(source, target, encoder, cancel, reviewed=True, overwrite=True)
    assert target.read_bytes() == b"previous"
    assert not list(target.parent.glob(".nova-video-*"))


def test_explicit_overwrite_is_atomic_and_no_partial_target_is_seen(files, monkeypatch):
    source, target, encoder = files
    target.write_bytes(b"previous")

    def run(command, cancel, log, *, output=None):
        assert target.read_bytes() == b"previous"
        if output:
            output.write_bytes(movie())

    monkeypatch.setattr(video, "_run", run)
    convert_video(source, target, encoder, reviewed=True, overwrite=True)
    assert target.read_bytes() == movie()


@pytest.mark.parametrize("failure", ["cancel", "time", "log", "output", "exit"])
def test_process_boundary_kills_or_reaps_child_and_bounds_time_logs_bytes(
    tmp_path, monkeypatch, failure
):
    cancel = Event()
    terminated = []
    log, output = tmp_path / "error.log", tmp_path / "out.mp4"

    class Process:
        def __init__(self, command, **kwargs):
            assert kwargs["shell"] is False and kwargs["stdin"] == subprocess.DEVNULL
            if failure == "log":
                kwargs["stderr"].write(b"x" * (video.MAX_LOG_BYTES + 1))
                kwargs["stderr"].flush()
            if failure == "output":
                output.write_bytes(bytes(11))
            self.stopped = False

        def poll(self):
            return 1 if failure == "exit" else 0 if self.stopped else None

        def terminate(self):
            terminated.append(True)
            self.stopped = True

        def wait(self, timeout):
            return 0

    monkeypatch.setattr(video.subprocess, "Popen", Process)
    if failure == "cancel":
        monkeypatch.setattr(cancel, "wait", lambda _: cancel.set())
    if failure == "time":
        times = iter([0, video.MAX_WALL_SECONDS + 1])
        monkeypatch.setattr(video.time, "monotonic", lambda: next(times))
    if failure == "output":
        monkeypatch.setattr(video, "MAX_BYTES", 10)
    with pytest.raises((VideoError, Cancelled)):
        video._run(["explicit-local-ffmpeg"], cancel, log, output=output)
    assert bool(terminated) is (failure != "exit")


def test_pre_cancelled_job_never_starts_a_process(files, monkeypatch):
    cancel = Event()
    cancel.set()
    monkeypatch.setattr(
        video.subprocess, "Popen", lambda *a, **k: pytest.fail("started executable")
    )
    with pytest.raises(Cancelled):
        convert_video(*files, cancel, reviewed=True)


FFMPEG = os.environ.get("NOVA_FFMPEG")


@pytest.mark.skipif(
    not FFMPEG, reason="Optional real FFmpeg must be explicitly supplied in NOVA_FFMPEG"
)
@pytest.mark.parametrize("audio", [True, False])
def test_real_ffmpeg_reencodes_decodes_h264_aac_and_keeps_silent_input_silent(tmp_path, audio):
    """Actual local conversion, test pattern/tone only, not speech or Windows QA."""
    source, target = tmp_path / "input.webm", tmp_path / "output.mp4"
    command = [
        FFMPEG,
        "-v",
        "error",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        "color=c=0xDBEAFE:s=640x360:r=12:d=0.8",
    ]
    if audio:
        command += ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=0.8"]
    command += ["-c:v", "libvpx-vp9", "-threads", "2"]
    if audio:
        command += ["-c:a", "libopus"]
    subprocess.run(command + [str(source)], check=True, timeout=30, capture_output=True)
    result = convert_video(source, target, Path(FFMPEG), reviewed=True)
    assert result.has_audio is audio and 0.7 < result.duration_seconds < 1.0
    info = subprocess.run(
        [FFMPEG, "-hide_banner", "-i", str(target), "-f", "null", "-"],
        check=True,
        timeout=30,
        capture_output=True,
    ).stderr.decode()
    assert "h264 (Main)" in info and "yuv420p" in info and "1280x720" in info and "20 fps" in info
    assert ("aac (LC)" in info) is audio
    assert "moov" not in info.lower() or "error" not in info.lower()
