"""Regressions for pasted, inline Arabic/English speaker spans and closing tags."""

import pytest

from nova_voice.dialogue import DialogueTurn, parse_dialogue, preview_dialogue, tag_line
from nova_voice.text import ScriptError


@pytest.mark.parametrize(
    "script",
    [
        "[1] أهلًا بكم![2] Greetings and introductions.[1] التحيات والتعارف.",
        "[1] أهلًا بكم![/1][2] Greetings and introductions.[/2][1] التحيات والتعارف.[/1]",
        "[1] أهلًا بكم![/1]\n[2] Greetings and introductions.[/2]\n[1] التحيات والتعارف.[/1]",
        "[1] أهلًا بكم![/1] [2] Greetings and introductions. [1] التحيات والتعارف.",
        "[١] أهلًا بكم![/١][٢] Greetings and introductions.[/٢][١] التحيات والتعارف.[/١]",
        "[a] أهلًا بكم![/A][b] Greetings and introductions.[/B][a] التحيات والتعارف.[/a]",
        "1: أهلًا بكم![/1]\n2: Greetings and introductions.[/2]\n1: التحيات والتعارف.[/1]",
    ],
)
def test_inline_and_optional_closing_markers_are_structure_not_speech(script):
    assert parse_dialogue(script) == [
        DialogueTurn(1, "أهلًا بكم!"),
        DialogueTurn(2, "Greetings and introductions."),
        DialogueTurn(1, "التحيات والتعارف."),
    ]


def test_lines_within_a_paired_span_keep_their_paragraph_boundaries():
    assert parse_dialogue("[2]\nHello.\n\nAnother paragraph.\n[/2]") == [
        DialogueTurn(2, "Hello.\n\nAnother paragraph.")
    ]


@pytest.mark.parametrize(
    "script",
    [
        "[/1] أهلًا بكم!",
        "[1] أهلًا.[/1][/1]",
        "[1] أهلًا.[/2]",
        "[1] أهلًا.[/1] Hello without a speaker. [2] Goodbye.",
        "[1] أهلًا.[/1]\nHello without a speaker.",
        "[1] أهلًا.[/1][2][/2]",
        "[1][/1][2] Hello.",
        "[1] أهلًا.[2]",
        "[1] أهلًا.[3] Hello.",
        "[1] أهلًا.[/3]",
        "[1] أهلًا.[/ 1]",
        "[1] أهلًا.[ /1]",
        "[1] أهلًا.[/1",
        "[1] أهلًا.[2",
        "[1] أهلًا.[ 2] Hello.",
        "[1] أهلًا.[2] Hello.[/2][/1]",
        "[/1]أهلًا بكم! اليوم نتعلّم كيف نُحيّي الآخرين ونُقدّم أنفسنا."
        "[/1]الدرس الأول. [/1][2]Greetings and Introductions. [/2]"
        "[1]التحياتوالتعارف.[/1]التحيات – [/1][2]Greetings[/2]"
        "Hello! — [/2][1]مرحبًا![/1]Good morning! — [/2][1]صباح الخير![/1]",
    ],
)
def test_bad_markers_and_unassigned_text_are_rejected_instead_of_spoken(script):
    with pytest.raises(ScriptError):
        parse_dialogue(script)


def test_orphan_close_has_an_actionable_message_and_correct_line_number():
    with pytest.raises(ScriptError) as error:
        parse_dialogue("[1] Hello.\nAnother sentence.\n[/1]\n[/2] Reply.")
    message = str(error.value)
    assert "[/2]" in message
    assert "[2]" in message
    assert "4" in message


def test_mismatched_close_identifies_the_expected_role():
    with pytest.raises(ScriptError) as error:
        parse_dialogue("[1] Hello.[/2]")
    assert "[/1]" in str(error.value)
    assert "[/2]" in str(error.value)


def test_preview_of_paired_inline_spans_stays_valid_and_does_not_leak_closers():
    script = "[1] مرحبًا بكم في درس جديد.[/1][2] Hello and welcome to the lesson.[/2]"
    preview = preview_dialogue(script, limit=48)
    turns = parse_dialogue(preview)
    assert turns[0] == DialogueTurn(1, "مرحبًا بكم في درس جديد.")
    assert [turn.speaker for turn in turns] == [1, 2]
    assert sum(len(turn.text) for turn in turns) <= 48
    assert all("[" not in turn.text and "]" not in turn.text for turn in turns)


@pytest.mark.parametrize("script", ["[1] مرحبًا.[/1]", "[١] مرحبًا.[/١]", "A: مرحبًا.[/A]"])
def test_reassigning_a_paired_paragraph_does_not_leave_a_stale_closing_tag(script):
    reassigned = tag_line(script, 2)
    assert parse_dialogue(reassigned) == [DialogueTurn(2, "مرحبًا.")]
    assert "[/" not in reassigned


@pytest.mark.parametrize("role", [1, 2])
def test_reassigning_a_mixed_paragraph_preserves_other_roles(role):
    reassigned = tag_line("[1] مرحبًا.[/1][2] Hello.[/2]", role)
    assert parse_dialogue(reassigned) == [DialogueTurn(role, "مرحبًا."), DialogueTurn(2, "Hello.")]


def test_ordinary_brackets_and_times_are_not_accidentally_removed():
    assert parse_dialogue("[1] Say [example] at 10:30.\nTime: 11:45.") == [
        DialogueTurn(1, "Say [example] at 10:30.\nTime: 11:45.")
    ]


@pytest.mark.parametrize("indent", [" ", "    ", "\t"])
def test_indented_openers_closers_and_aliases_are_not_mistaken_for_unknown_tags(indent):
    script = f"[1] Hello.\n{indent}[/1]\n{indent}[2] Reply.\n{indent}[/2]"
    assert parse_dialogue(script) == [DialogueTurn(1, "Hello."), DialogueTurn(2, "Reply.")]
    script = f"[1] Hello.\n{indent}2: Reply."
    assert parse_dialogue(script) == [DialogueTurn(1, "Hello."), DialogueTurn(2, "Reply.")]
