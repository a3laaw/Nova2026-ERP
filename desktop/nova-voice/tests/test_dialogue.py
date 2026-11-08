import pytest

from nova_voice.dialogue import (
    BILINGUAL_EXAMPLE,
    DialogueTurn,
    parse_dialogue,
    preview_dialogue,
    tag_line,
)
from nova_voice.text import MAX_CHARACTERS, ScriptError


def test_question_and_reply_preserve_order_without_speaking_tags():
    turns = parse_dialogue("[1] مرحبًا، كيف حالك؟\n[2] I'm fine, thank you!\n[1] رائع.")
    assert turns == [
        DialogueTurn(1, "مرحبًا، كيف حالك؟"),
        DialogueTurn(2, "I'm fine, thank you!"),
        DialogueTurn(1, "رائع."),
    ]


@pytest.mark.parametrize(
    "first,second",
    [
        ("[1]", "[2]"),
        ("1:", "2:"),
        ("١:", "٢:"),
        ("A:", "B:"),
        ("[a]", "[b]"),
        ("[١]", "[٢]"),
        ("1：", "2："),
    ],
)
def test_convenient_marker_aliases(first, second):
    turns = parse_dialogue(f"{first} Hello.\r\n{second} أهلًا.")
    assert [turn.speaker for turn in turns] == [1, 2]
    assert [turn.text for turn in turns] == ["Hello.", "أهلًا."]


def test_continuation_lines_and_paragraphs_keep_the_current_voice():
    turns = parse_dialogue("[1]\nHello.\nTime: 10:30\n\nAnother paragraph.\n[2] Reply.")
    assert turns[0].text == "Hello.\nTime: 10:30\n\nAnother paragraph."
    assert turns[1].text == "Reply."


@pytest.mark.parametrize(
    "script",
    [
        "Unassigned opening.\n[1] Hello.",
        "[3] Hello.",
        "[1] Hello.\nC: Wrong role.",
        "[1] Hello.\n3: Wrong role.",
        "[voice] Hello.",
        "[1]\n[2] Reply.",
        "[1] Hello.\n[2]",
        "[1] ؟؟؟\n[2] Reply.",
    ],
)
def test_invalid_or_empty_turns_are_not_silently_read(script):
    with pytest.raises(ScriptError):
        parse_dialogue(script)


def test_whole_script_limit_includes_labels():
    with pytest.raises(ScriptError):
        parse_dialogue("[1] " + "س" * MAX_CHARACTERS)


def test_embedded_voice_markers_switch_roles_but_other_brackets_are_content():
    assert parse_dialogue("[1] Say [example].[2] This is the reply.") == [
        DialogueTurn(1, "Say [example]."),
        DialogueTurn(2, "This is the reply."),
    ]


def test_preview_trims_content_but_keeps_valid_labels_and_order():
    preview = preview_dialogue(BILINGUAL_EXAMPLE, limit=100)
    turns = parse_dialogue(preview)
    assert [turn.speaker for turn in turns[:2]] == [1, 2]
    assert sum(len(turn.text) for turn in turns) <= 100
    assert turns[0] == parse_dialogue(BILINGUAL_EXAMPLE)[0]
    assert preview_dialogue("[2] Short reply.") == "[2] Short reply."


def test_tagging_reassigns_paragraph_instead_of_stacking_tags():
    assert tag_line("مرحبا", 1) == "[1] مرحبا"
    assert tag_line("[1] مرحبا", 2) == "[2] مرحبا"
    assert tag_line("A: Hello", 2) == "[2] Hello"
    with pytest.raises(ValueError):
        tag_line("Hello", 3)
