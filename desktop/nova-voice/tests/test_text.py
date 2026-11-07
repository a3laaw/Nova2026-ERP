import re

import pytest

from nova_voice.text import (
    MAX_CHARACTERS,
    ScriptError,
    preview_text,
    read_script,
    split_text,
    validate_text,
)


@pytest.mark.parametrize("text", ["", " \t\n", "؟! ...", "🙂"])
def test_rejects_non_script(text):
    with pytest.raises(ScriptError):
        validate_text(text)


def test_size_and_nul_validation():
    with pytest.raises(ScriptError):
        validate_text("س" * (MAX_CHARACTERS + 1))
    with pytest.raises(ScriptError):
        validate_text("مرحبًا\x00")
    assert validate_text("نعم\r\nأهلًا") == "نعم\nأهلًا"


@pytest.mark.parametrize(
    "text",
    [
        "أهلًا بك! كيف حالك؟ هذا نص عربي.\nوهذه فقرة أخرى.",
        ("كلمات عربية دون علامات ترقيم " * 1000).strip(),
        "ن" * 4000,
        "Hello.\n\nAnother paragraph! " + "Word " * 500,
        "سَلَامٌ عَلَيْكُمْ " * 1000,
    ],
)
def test_bounded_chunks_preserve_script(text):
    chunks = split_text(text)
    assert all(0 < len(chunk.text) <= 480 for chunk in chunks)
    joined = " ".join(chunk.text for chunk in chunks)
    assert re.sub(r"\s", "", joined) == re.sub(r"\s", "", text)
    assert chunks[-1].paragraph_end


def test_paragraph_markers_do_not_add_pause_for_every_chunk():
    chunks = split_text("word " * 200 + "\nSecond paragraph.")
    assert sum(chunk.paragraph_end for chunk in chunks) == 2
    assert not chunks[0].paragraph_end


def test_preview_is_bounded_and_word_aware():
    assert preview_text("مرحبا بالعالم") == "مرحبا بالعالم"
    text = "مرحبا بكم في البرنامج " * 100
    assert len(preview_text(text)) <= 400
    assert text.startswith(preview_text(text))


@pytest.mark.parametrize("encoding", ["utf-8", "utf-8-sig", "utf-16"])
def test_read_arabic_script(tmp_path, encoding):
    path = tmp_path / "نص.txt"
    path.write_text("مرحبًا بالعالم", encoding=encoding)
    assert read_script(path) == "مرحبًا بالعالم"


def test_rejects_binary_and_oversized_files(tmp_path):
    path = tmp_path / "script.txt"
    path.write_bytes(b"\xff\x82\x80")
    with pytest.raises(ScriptError, match="UTF-8"):
        read_script(path)
    path.write_bytes(b"a" * (2 * 1024 * 1024 + 1))
    with pytest.raises(ScriptError, match="2"):
        read_script(path)
