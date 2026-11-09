"""Optional local FFmpeg conversion. No downloads, shell, Qt or network protocols.

Only an explicitly selected trusted executable is run. Conversion writes to a
same-directory staging file, checks MP4 codec metadata and decodes the entire
result before publication. Review is a user acknowledgement, not content approval.
"""

import os
import struct
import subprocess
import tempfile
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path
from threading import Event

from .text import ScriptError
from .voices import check_cancelled

MAX_BYTES = 128 * 1024 * 1024
MAX_SECONDS = 900
MAX_WALL_SECONDS = 1800
MAX_METADATA_BYTES = 4 * 1024 * 1024
MAX_LOG_BYTES = 64 * 1024


class VideoError(ScriptError):
    """Recoverable local conversion error; never expose input contents/logs."""


def _require(condition: bool, message: str = "بيانات MP4 غير صالحة أو غير متوافقة.") -> None:
    if not condition:
        raise VideoError(message)


@dataclass(frozen=True)
class VideoResult:
    path: Path
    duration_seconds: float
    width: int
    height: int
    has_audio: bool
    size_bytes: int


def _boxes(data: bytes, start: int = 0, end: int | None = None) -> Iterator[tuple[bytes, bytes]]:
    """Bounded ISO-BMFF metadata boxes; no recursion into media payloads."""
    end = len(data) if end is None else end
    count = 0
    while start < end:
        _require(end - start >= 8)
        size, kind = struct.unpack_from(">I4s", data, start)
        header = 8
        if size == 1:
            _require(end - start >= 16)
            size, header = struct.unpack_from(">Q", data, start + 8)[0], 16
        elif size == 0:
            size = end - start
        _require(header <= size <= end - start and count < 4096)
        yield kind, data[start + header : start + size]
        start += size
        count += 1


def _one(data: bytes, kind: bytes) -> bytes:
    matches = [value for name, value in _boxes(data) if name == kind]
    _require(len(matches) == 1)
    return matches[0]


def _duration(data: bytes) -> float:
    _require(len(data) >= 20 and data[0] in (0, 1))
    at, fmt = (12, ">II") if data[0] == 0 else (20, ">IQ")
    _require(len(data) >= at + struct.calcsize(fmt))
    scale, ticks = struct.unpack_from(fmt, data, at)
    _require(scale > 0 and 0 < ticks / scale <= MAX_SECONDS)
    return ticks / scale


def _descriptor(data: bytes, at: int) -> tuple[int, bytes, int]:
    _require(0 <= at < len(data))
    tag, size = data[at], 0
    at += 1
    for _ in range(4):
        _require(at < len(data))
        value = data[at]
        at += 1
        size = (size << 7) | (value & 127)
        if value < 128:
            _require(size <= len(data) - at)
            return tag, data[at : at + size], at + size
    raise VideoError("وصف ترميز الصوت في MP4 غير صالح.")


def _aac_lc(esds: bytes) -> bool:
    """Verify MPEG-4 Audio / AAC-LC, not just the ambiguous mp4a sample tag."""
    if len(esds) < 8 or esds[:4] != bytes(4):
        return False
    tag, es, _ = _descriptor(esds, 4)
    if tag != 3 or len(es) < 3 or es[2] != 0:
        return False  # No URL/dependency/remote stream descriptors.
    tag, decoder, _ = _descriptor(es, 3)
    if tag != 4 or len(decoder) < 13 or decoder[0] != 0x40 or decoder[1] >> 2 != 5:
        return False
    tag, config, _ = _descriptor(decoder, 13)
    return tag == 5 and len(config) >= 2 and config[0] >> 3 == 2


def inspect_mp4(path: Path) -> VideoResult:
    """Inspect our constrained MP4 profile without ffprobe or loading video RAM.

    This checks container/sample metadata, not every H.264/AAC bitstream. The
    converter separately performs a complete decode before publishing the file.
    """
    size = path.stat().st_size
    _require(16 <= size <= MAX_BYTES, "حجم الفيديو فارغ أو يتجاوز حد 128 MiB.")
    moov, moov_at, mdat_at, ftyp = None, None, None, False
    with path.open("rb") as stream:
        at, count = 0, 0
        while at < size:
            head = stream.read(8)
            _require(len(head) == 8 and count < 4096)
            length, kind = struct.unpack(">I4s", head)
            header = 8
            if length == 1:
                head = stream.read(8)
                _require(len(head) == 8)
                length, header = struct.unpack(">Q", head)[0], 16
            elif length == 0:
                length = size - at
            _require(header <= length <= size - at)
            if at == 0:
                _require(kind == b"ftyp")
                ftyp = True
            if kind == b"moov":
                _require(moov is None and length - header <= MAX_METADATA_BYTES)
                moov, moov_at = stream.read(length - header), at
            elif kind == b"mdat" and mdat_at is None:
                mdat_at = at
            stream.seek(at + length)
            at += length
            count += 1
    _require(ftyp and moov is not None and mdat_at is not None and moov_at < mdat_at)
    duration = _duration(_one(moov, b"mvhd"))
    tracks = [data for name, data in _boxes(moov) if name == b"trak"]
    _require(1 <= len(tracks) <= 2)
    width = height = 0
    video = audio = False
    for track in tracks:
        mdia = _one(track, b"mdia")
        _duration(_one(mdia, b"mdhd"))
        handler = _one(mdia, b"hdlr")
        _require(len(handler) >= 12)
        role = handler[8:12]
        minf = _one(mdia, b"minf")
        dref = _one(_one(minf, b"dinf"), b"dref")
        _require(len(dref) >= 8 and dref[4:8] == b"\0\0\0\1")
        refs = list(_boxes(dref, 8))
        _require(refs == [(b"url ", b"\0\0\0\1")])  # Self-contained, no external files.
        stsd = _one(_one(minf, b"stbl"), b"stsd")
        _require(len(stsd) >= 8 and stsd[4:8] == b"\0\0\0\1")
        entries = list(_boxes(stsd, 8))
        _require(len(entries) == 1)
        codec, sample = entries[0]
        if role == b"vide":
            _require(not video and codec == b"avc1" and len(sample) >= 78)
            width, height = struct.unpack_from(">HH", sample, 24)
            avcc = _one(sample[78:], b"avcC")
            _require(len(avcc) >= 4 and avcc[0] == 1 and avcc[1] == 77 and avcc[3] == 31)
            _require((width, height) == (1280, 720))
            video = True
        elif role == b"soun":
            _require(not audio and codec == b"mp4a" and len(sample) >= 28)
            _require(_aac_lc(_one(sample[28:], b"esds")))
            audio = True
        else:
            raise VideoError("MP4 يتضمن مسارًا غير الصوت والصورة المتوقعين.")
    _require(video, "لم يُعثر على مسار H.264 Main 720p في الفيديو.")
    return VideoResult(path, duration, width, height, audio, size)


def _run(command: list[str], cancel: Event, error_log: Path, *, output: Path | None = None) -> None:
    """Poll a single local encoder; bounded logs/time and cooperative cancellation."""
    check_cancelled(cancel)
    process = None
    started = time.monotonic()
    try:
        with error_log.open("wb") as log:
            process = subprocess.Popen(
                command,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=log,
                shell=False,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            while True:
                check_cancelled(cancel)
                _require(
                    time.monotonic() - started <= MAX_WALL_SECONDS, "انتهت مهلة التحويل المحلي."
                )
                _require(
                    error_log.stat().st_size <= MAX_LOG_BYTES, "أوقف التحويل لكثرة أخطاء الترميز."
                )
                if output and output.exists():
                    _require(output.stat().st_size <= MAX_BYTES, "تجاوز الفيديو حد 128 MiB.")
                code = process.poll()
                if code is not None:
                    _require(
                        code == 0,
                        "تعذّر الترميز أو فك الفيديو. اختر FFmpeg موثوقًا يدعم libx264 وAAC "
                        "وملف WebM/MP4 سليمًا؛ لم يُستبدل الملف السابق.",
                    )
                    return
                cancel.wait(0.05)
    except OSError as error:
        raise VideoError(
            "تعذّر تشغيل FFmpeg المحلي أو الوصول إلى الملفات. راجع اختيارك وصلاحياته."
        ) from error
    finally:
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)


def convert_video(
    source: Path,
    destination: Path,
    ffmpeg: Path,
    cancel: Event | None = None,
    progress: Callable[[int], None] = lambda _: None,
    *,
    reviewed: bool = False,
    overwrite: bool = False,
) -> VideoResult:
    """Re-encode a reviewed local file to H.264 Main/yuv420p + optional AAC-LC.

    FFmpeg is optional and must be supplied explicitly. No discovery, installation,
    upload, shell, automatic speech, template selection or silent paid fallback.
    """
    _require(reviewed is True, "راجع الفيديو والنطق وحقوق استخدامه ثم أكّد المراجعة أولًا.")
    _require(type(overwrite) is bool)
    cancel = cancel if cancel is not None else Event()
    check_cancelled(cancel)
    source, ffmpeg = source.expanduser().resolve(), ffmpeg.expanduser().resolve()
    # Preserve the destination name (including a symlink) so atomic replacement
    # never follows it and writes into some other existing file.
    destination = destination.expanduser().absolute()
    _require(
        source.is_file() and source.suffix.lower() in (".webm", ".mp4"),
        "اختر فيديو WebM أو MP4 محليًا.",
    )
    if os.name == "nt":
        _require(
            ffmpeg.suffix.lower() == ".exe",
            "على Windows اختر ffmpeg.exe موثوقًا، لا BAT/CMD أو سكريبتًا.",
        )
    _require(
        ffmpeg.is_file() and ffmpeg not in (source, destination),
        "اختر ملف FFmpeg التنفيذي الموثوق محليًا.",
    )
    _require(
        destination.suffix.lower() == ".mp4" and destination.parent.is_dir(),
        "اختر اسم MP4 في مجلد موجود.",
    )
    _require(
        destination.resolve() not in (source, ffmpeg), "اختر اسمًا مختلفًا عن الفيديو الأصلي وFFmpeg."
    )
    if destination.exists():
        _require(not destination.samefile(source) and not destination.samefile(ffmpeg))
        _require(
            overwrite and destination.is_file(),
            "الملف موجود؛ اختر اسمًا جديدًا أو وافق صراحة على الاستبدال.",
        )
    _require(0 < source.stat().st_size <= MAX_BYTES, "حجم المصدر فارغ أو يتجاوز 128 MiB.")
    with source.open("rb") as stream:
        head = stream.read(12)
    webm = head.startswith(b"\x1aE\xdf\xa3")
    _require(
        webm if source.suffix.lower() == ".webm" else head[4:8] == b"ftyp",
        "امتداد الفيديو لا يطابق ترويسة حاويته.",
    )
    before = source.stat()
    common = [str(ffmpeg), "-nostdin", "-hide_banner", "-loglevel", "error", "-nostats"]
    # Forced demuxers cannot route a disguised playlist; MOV data references are
    # disabled. A protocol allowlist prevents HTTP/TLS/UDP/etc even for crafted input.
    input_args = ["-protocol_whitelist", "file,pipe", "-f", "matroska" if webm else "mov"]
    if not webm:
        input_args += ["-enable_drefs", "0", "-use_absolute_path", "0"]
    input_args += ["-i", str(source)]
    progress(-1)
    with tempfile.TemporaryDirectory(prefix=".nova-video-", dir=destination.parent) as staging:
        temp = Path(staging)
        candidate = temp / "converted.mp4"
        command = (
            common
            + ["-y", "-fflags", "+genpts"]
            + input_args
            + [
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-sn",
                "-dn",
                "-map_metadata",
                "-1",
                "-map_chapters",
                "-1",
                "-t",
                str(MAX_SECONDS + 1),
                "-vf",
                "scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,"
                "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xF8FAFC,setsar=1,fps=20",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-pix_fmt",
                "yuv420p",
                "-profile:v",
                "main",
                "-level:v",
                "3.1",
                "-threads",
                "2",
                "-filter_threads",
                "1",
                "-c:a",
                "aac",
                "-profile:a",
                "aac_low",
                "-ac",
                "2",
                "-ar",
                "48000",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                "-f",
                "mp4",
                str(candidate),
            ]
        )
        _run(command, cancel, temp / "encode.log", output=candidate)
        check_cancelled(cancel)
        progress(90)
        result = inspect_mp4(candidate)
        _run(
            common
            + [
                "-xerror",
                "-protocol_whitelist",
                "file,pipe",
                "-f",
                "mov",
                "-enable_drefs",
                "0",
                "-use_absolute_path",
                "0",
                "-i",
                str(candidate),
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-f",
                "null",
                "-",
            ],
            cancel,
            temp / "decode.log",
        )
        current = source.stat()
        _require(
            (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
            == (current.st_dev, current.st_ino, current.st_size, current.st_mtime_ns),
            "تغير الفيديو الأصلي أثناء التحويل؛ أعد المراجعة والمحاولة.",
        )
        progress(99)
        check_cancelled(cancel)
        if overwrite:
            candidate.replace(destination)
        elif os.name == "nt":
            candidate.rename(destination)  # Windows rename never clobbers an existing path.
        else:
            os.link(candidate, destination)  # Atomic no-clobber publication on POSIX.
            candidate.unlink()
    progress(100)
    return VideoResult(
        destination,
        result.duration_seconds,
        result.width,
        result.height,
        result.has_audio,
        result.size_bytes,
    )
