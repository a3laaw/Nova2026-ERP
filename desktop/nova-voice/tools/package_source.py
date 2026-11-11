"""Create the small, standalone source handoff without environments, models or audio."""

import argparse
import struct
import tempfile
import tomllib
import zipfile
import zlib
from pathlib import Path, PurePosixPath

DIRECTORIES = ("nova_voice", "tools", "assets", "tests", "examples", "web-tests", "installer")
FILES = (
    ".gitignore",
    "run.py",
    "pyproject.toml",
    "requirements.txt",
    "requirements-dev.txt",
    "NovaVoice.spec",
    "README.md",
    "START-HERE.txt",
    "RUN-FIRST-AR.html",
    "HTML-GUIDE.md",
    "WHITEBOARD-GUIDE.md",
    "SMART-SCENES-AR.md",
    "FULL-LESSON-AR.md",
    "LESSON-OUTPUT-AR.md",
    "VIDEO-MOTION-AR.md",
    "COMPOSITION-MOTION-AR.md",
    "SECONDARY-SOURCES-AR.md",
    "REVIEW-CHOICES-AR.md",
    "SCENE-HISTORY-AR.md",
    "AZURE-SPEECH-AR.md",
    "LESSON-LIBRARY-AR.md",
    "INSTALL-WINDOWS-AR.md",
    "INFERENCE-GUIDE-AR.md",
    "INFERENCE-GUIDE-AR.html",
    "CHANGELOG.md",
    "TIMING-VERIFICATION-AR.md",
    "UI-ORGANIZATION-AR.md",
    "EGYPTIAN-VOICES-AR.md",
    "BRITISH-ENGLISH-AR.md",
    "FINAL-RELEASE-AR.md",
    "KIDS-GUIDE-AR.md",
    "LICENSE",
    "THIRD_PARTY.md",
    "Setup-Windows.bat",
    "Run-Windows.bat",
    "Download-Arabic-Voice.bat",
    "Download-English-Voice.bat",
    "Build-Windows.bat",
    "voices/README.md",
)


def _rar_block(kind: int, flags: int, payload: bytes = b"") -> bytes:
    """Classic RAR header with its standard, truncated CRC32."""
    if len(payload) + 7 > 65535:
        raise ValueError("RAR header is too large")
    body = struct.pack("<BHH", kind, flags, 7 + len(payload)) + payload
    return struct.pack("<H", zlib.crc32(body) & 0xFFFF) + body


def _write_stored_rar(source_zip: Path, output: Path) -> None:
    """A real, single-volume RAR (STORE method), not a renamed ZIP.

    Source is small, so no proprietary compressor or installed WinRAR is needed.
    This deliberately supports regular files only, not encryption/solid archives.
    CRCs cover the exact bytes already normalized for the Windows ZIP handoff.
    """
    with zipfile.ZipFile(source_zip) as source, output.open("wb") as target:
        target.write(b"Rar!\x1a\x07\x00")
        target.write(_rar_block(0x73, 0, bytes(6)))
        for entry in source.infolist():
            path = PurePosixPath(entry.filename)
            if entry.is_dir() or path.is_absolute() or ".." in path.parts:
                raise ValueError("Only safe, regular source paths can be archived")
            name = entry.filename.replace("/", "\\").encode("utf-8")
            if b"\x00" in name or entry.file_size >= 2**32:
                raise ValueError("Source entry cannot be represented by this RAR writer")
            flags = 0x8000 | (0x0200 if not name.isascii() else 0)
            year, month, day, hour, minute, second = entry.date_time
            dos_time = (
                ((year - 1980) << 25)
                | (month << 21)
                | (day << 16)
                | (hour << 11)
                | (minute << 5)
                | (second // 2)
            )
            metadata = struct.pack(
                "<LLBLLBBHL",
                entry.file_size,
                entry.file_size,
                2,
                entry.CRC,
                dos_time,
                20,
                0x30,
                len(name),
                0x20,
            )
            target.write(_rar_block(0x74, flags, metadata + name))
            with source.open(entry) as member:
                while data := member.read(1024 * 1024):
                    target.write(data)
        target.write(_rar_block(0x7B, 0x4000))


def package_source(root: Path, output: Path) -> int:
    if output.suffix.lower() not in (".zip", ".rar"):
        raise ValueError("Source handoff must use .zip or .rar")
    paths = [root / filename for filename in FILES]
    for directory in DIRECTORIES:
        paths.extend(
            path
            for path in (root / directory).rglob("*")
            if path.is_file()
            and not {"__pycache__", "node_modules"}.intersection(path.parts)
            and path.suffix.lower()
            not in (".pyc", ".mp3", ".wav", ".mp4", ".webm", ".mkv", ".mov", ".zip", ".rar")
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="nova-voice-package-", dir=output.parent) as temp:
        temporary = Path(temp) / "source.zip"
        with zipfile.ZipFile(
            temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
        ) as archive:
            for path in sorted(set(paths)):
                name = "NovaVoice-Source/" + path.relative_to(root).as_posix()
                if path.suffix == ".bat":
                    # Native Windows line endings in the downloadable handoff.
                    archive.writestr(
                        name, path.read_text().replace("\r\n", "\n").replace("\n", "\r\n")
                    )
                else:
                    archive.write(path, name)
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise ValueError("Source archive failed its integrity check")
        if output.suffix.lower() == ".rar":
            rar_path = Path(temp) / "source.rar"
            _write_stored_rar(temporary, rar_path)
            temporary = rar_path
        temporary.replace(output)
    return len(set(paths))


def default_destination(root: Path) -> Path:
    """Keep release files out of source; also work in an extracted standalone copy."""
    with (root / "pyproject.toml").open("rb") as project:
        version = tomllib.load(project)["project"]["version"]
    repository = root.parent.parent
    in_checkout = (
        root.name == "nova-voice"
        and root.parent.name == "desktop"
        and (repository / ".git").exists()
    )
    directory = repository / "deliverables" / "nova-voice" if in_checkout else root / "deliverables"
    return directory / f"NovaVoice-Source-v{version}.rar"


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=default_destination(root),
        help="Output .zip or .rar; default is a visible RAR in the deliverables folder",
    )
    args = parser.parse_args()
    count = package_source(root, args.output)
    print(f"Packaged {count} files: {args.output} ({args.output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
