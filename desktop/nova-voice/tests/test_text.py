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
    ids=["arabic-basic", "arabic-long-plain", "n-4000", "english-long", "arabic-tashkeel-long"],
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


@pytest.mark.parametrize(
    "mark",
    [
        "\ufeff", "\u200b", "\u200e", "\u200f", "\u202a", "\u202c",
        "\u202e", "\u2060", "\u2066", "\u2069", "\u00ad",
    ],
    ids=[
        "bom", "zwsp", "lrm", "rlm", "lre", "pdf",
        "rlo", "word_joiner", "lri", "pdi", "soft_hyphen",
    ],
)
def test_invisible_direction_marks_are_stripped(mark):
    from nova_voice.text import validate_text as _validate_text

    assert _validate_text(mark + "مرحبًا بالعالم" + mark) == "مرحبًا بالعالم"
    # mid-text invisible direction marks are not part of the words either
    assert _validate_text("الدرس" + mark + " الأول") == "الدرس الأول"


def test_invisible_marks_do_not_block_dialogue_markers():
    from nova_voice.dialogue import parse_dialogue

    script = "\ufeff[1]أهلًا![/1]\n\u200f[2]Hello![/2]\n"
    turns = parse_dialogue(script)
    assert [turn.speaker for turn in turns] == [1, 2]


def test_meaningful_joiners_are_preserved():
    from nova_voice.text import validate_text as _validate_text

    assert "می‌شود" in _validate_text("کلمه می‌شود آزمون")  # ZWNJ kept
    assert "👨‍👩‍👧" in _validate_text("عائلة 👨‍👩‍👧 اختبار")  # ZWJ kept
