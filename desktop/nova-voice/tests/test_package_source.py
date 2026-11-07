import struct
import zipfile
import zlib

import pytest

from tools.package_source import (
    DIRECTORIES,
    FILES,
    _rar_block,
    default_destination,
    package_source,
)


@pytest.fixture
def source_root(tmp_path):
    root = tmp_path / "app"
    root.mkdir()
    for name in FILES:
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("@echo off\necho Test\n" if path.suffix == ".bat" else "Example: " + name)
    for name in DIRECTORIES:
        (root / name).mkdir(exist_ok=True)
    (root / "assets" / "binary.ico").write_bytes(bytes(range(256)))
    (root / "examples" / "empty.txt").write_bytes(b"")
    return root


def stored_rar_entries(path):
    """Read only the documented classic RAR headers/STORE records, independently."""
    data = path.read_bytes()
    assert data[:7] == b"Rar!\x1a\x07\x00"
    entries = {}
    offset = 7
    ended = False
    while offset < len(data):
        crc, kind, flags, size = struct.unpack_from("<HBHH", data, offset)
        header = data[offset : offset + size]
        assert zlib.crc32(header[2:]) & 65535 == crc
        offset += size
        if kind == 0x73:
            assert size == 13
            assert flags == 0
        elif kind == 0x74:
            packed, unpacked, host, file_crc, _, version, method, name_size, attrs = (
                struct.unpack_from("<LLBLLBBHL", header, 7)
            )
            assert packed == unpacked
            assert host == 2 and version == 20 and method == 0x30 and attrs == 0x20
            assert flags & 0x8000
            assert size == 32 + name_size
            name = header[32:].decode("utf-8" if flags & 0x0200 else "ascii").replace("\\", "/")
            assert name not in entries
            content = data[offset : offset + packed]
            assert len(content) == unpacked
            assert zlib.crc32(content) & 0xFFFFFFFF == file_crc
            entries[name] = content
            offset += packed
        elif kind == 0x7B:
            assert size == 7 and offset == len(data)
            ended = True
        else:
            pytest.fail(f"Unexpected RAR block {kind}")
    assert ended
    return entries


def test_rar_uses_the_known_classic_main_header():
    assert _rar_block(0x73, 0, bytes(6)) == bytes.fromhex("cf907300000d00000000000000")


def test_zip_and_real_rar_contain_identical_source_bytes_and_windows_line_endings(source_root):
    zip_path = source_root / "source.zip"
    rar_path = source_root / "source.rar"
    assert package_source(source_root, zip_path) == package_source(source_root, rar_path)
    with zipfile.ZipFile(zip_path) as archive:
        zipped = {entry.filename: archive.read(entry) for entry in archive.infolist()}
    assert stored_rar_entries(rar_path) == zipped
    assert zipped["NovaVoice-Source/Setup-Windows.bat"] == b"@echo off\r\necho Test\r\n"
    assert zipped["NovaVoice-Source/assets/binary.ico"] == bytes(range(256))
    assert zipped["NovaVoice-Source/examples/empty.txt"] == b""
    assert "NovaVoice-Source/RUN-FIRST-AR.html" in zipped


def test_rar_preserves_utf8_names_and_contents(source_root):
    name = "دليل-التجربة.txt"
    text = "مرحبًا. Hello."
    (source_root / "examples" / name).write_text(text, encoding="utf-8")
    target = source_root / "unicode.rar"
    package_source(source_root, target)
    assert stored_rar_entries(target)["NovaVoice-Source/examples/" + name] == text.encode("utf-8")


def test_archives_and_large_generated_directories_are_excluded(source_root):
    for directory in ("node_modules", "__pycache__"):
        path = source_root / "assets" / directory
        path.mkdir()
        (path / "excluded.txt").write_text("not source")
    for suffix in (".rar", ".zip", ".WAV", ".mp3", ".pyc"):
        (source_root / "examples" / ("excluded" + suffix)).write_bytes(b"generated")
    target = source_root / "source.rar"
    package_source(source_root, target)
    assert not any("excluded" in name for name in stored_rar_entries(target))


def test_failed_packaging_preserves_an_existing_archive(source_root):
    target = source_root / "source.rar"
    target.write_bytes(b"previous successful archive")
    (source_root / "requirements.txt").unlink()
    with pytest.raises(FileNotFoundError):
        package_source(source_root, target)
    assert target.read_bytes() == b"previous successful archive"
    assert not list(source_root.glob("nova-voice-package-*"))


def test_unsupported_extension_is_not_silently_a_renamed_zip(source_root):
    target = source_root / "source.7z"
    with pytest.raises(ValueError, match=".zip or .rar"):
        package_source(source_root, target)
    assert not target.exists()


def test_default_output_of_an_extracted_source_stays_in_its_deliverables(source_root):
    (source_root / "pyproject.toml").write_text('[project]\nversion = "0.4.0"\n')
    assert default_destination(source_root) == (
        source_root / "deliverables" / "NovaVoice-Source-v0.4.0.rar"
    )


def test_checkout_default_output_is_a_visible_repo_deliverable(tmp_path):
    repository = tmp_path / "repo"
    root = repository / "desktop" / "nova-voice"
    root.mkdir(parents=True)
    (repository / ".git").mkdir()
    (root / "pyproject.toml").write_text('[project]\nversion = "0.4.0"\n')
    assert default_destination(root) == (
        repository / "deliverables" / "nova-voice" / "NovaVoice-Source-v0.4.0.rar"
    )


def test_named_desktop_folder_without_a_checkout_does_not_escape_source(tmp_path):
    root = tmp_path / "desktop" / "nova-voice"
    root.mkdir(parents=True)
    (root / "pyproject.toml").write_text('[project]\nversion = "0.4.0"\n')
    assert default_destination(root).parent == root / "deliverables"
