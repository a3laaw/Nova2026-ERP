"""Regression tests for the reported Arabic routing, wrapping and bilingual flow.

Synthetic PCM fixtures test control flow only, never human voice naturalness.
"""

import json
from dataclasses import replace
from pathlib import Path

import pytest

from nova_voice.appearance import AppearanceError, BoardAppearance, RowColor
from nova_voice.dialogue import DialogueTurn, merge_turns, parse_dialogue
from nova_voice.engine import RenderOptions, SpeechEngine
from nova_voice.language import narration_text, text_language, validate_spoken_language
from nova_voice.text import ScriptError
from nova_voice.voices import VoiceError
from nova_voice.whiteboard import (
    ROWS_PER_STEP,
    WhiteboardError,
    WhiteboardPage,
    parse_lesson,
    whiteboard_html,
)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("مرحبًا بالعالم!", "ar"),
        ("Hello، everyone!", "en"),
        ("١٢٣ 456 ؟ ، ـ …", "neutral"),
        ("Hello. مرحبًا.", "mixed"),
        ("Café", "en"),
        ("أهلاً، هذا درس 123.", "ar"),
        ("日本語", "neutral"),
    ],
)
def test_script_checks_use_letters_not_arabic_punctuation_or_digits(text, expected):
    assert text_language(text) == expected


@pytest.mark.parametrize(
    ("text", "family"),
    [("مرحبًا", "en"), ("Hello", "ar"), ("Hello مرحبًا", "en"), ("Hello مرحبًا", "ar")],
)
def test_wrong_or_mixed_language_is_an_explicit_role_specific_error(text, family):
    with pytest.raises(VoiceError, match="الصوت 2"):
        validate_spoken_language(text, family, 2)


def test_single_narration_rejects_arabic_before_loading_or_replacing_output(
    tmp_path, voice_spec, monkeypatch
):
    path = tmp_path / "existing.wav"
    path.write_bytes(b"preserve original")
    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", lambda _: pytest.fail("must not load a wrong voice"))
    with pytest.raises(VoiceError, match="إنجليزي"):
        engine.render("مرحبًا بكم", voice_spec, path, RenderOptions())
    assert path.read_bytes() == b"preserve original"
    assert not list(tmp_path.glob(".nova-voice-*"))


def test_every_dialogue_turn_is_checked_before_any_synthesis(tmp_path, bilingual_cast, monkeypatch):
    path = tmp_path / "existing.mp3"
    path.write_bytes(b"old audio")
    engine = SpeechEngine()
    monkeypatch.setattr(engine, "_load", lambda _: pytest.fail("must preflight the entire script"))
    with pytest.raises(VoiceError, match="الصوت 2"):
        engine.render_dialogue(
            "[1] مرحبًا.\n[2] Hello.\n[1] أهلاً.\n[2] نص عربي في الدور الخطأ.",
            bilingual_cast,
            path,
            RenderOptions(),
        )
    assert path.read_bytes() == b"old audio"


def test_roles_are_not_hardcoded_to_languages_and_same_role_has_no_reply_gap(
    tmp_path, bilingual_cast, monkeypatch
):
    engine = SpeechEngine()
    cast = {1: bilingual_cast[2], 2: bilingual_cast[1]}
    monkeypatch.setattr(engine, "_render", lambda blocks, *args: blocks)
    blocks = engine.render_dialogue(
        "[1] Hello.[/1][1] How are you?[/1][2] مرحبًا.[/2][2] كيف حالك؟[/2]",
        cast,
        tmp_path / "unused.wav",
        RenderOptions(),
        turn_pause_ms=400,
    )
    assert [block.text for block in blocks] == ["Hello. How are you?", "مرحبًا. كيف حالك؟"]
    assert [block.voice.language_family for block in blocks] == ["en", "ar"]
    assert [block.pause_after_ms for block in blocks] == [400, 400]


def test_changed_language_metadata_requires_refresh_before_loading(voice_spec):
    data = json.loads(voice_spec.config_path.read_text(encoding="utf-8"))
    data["language"] = {"code": "ar_JO", "name_native": "العربية"}
    data["espeak"]["voice"] = "ar"
    voice_spec.config_path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(VoiceError, match="تحديث"):
        SpeechEngine()._load(voice_spec)


def test_visual_wrapping_and_repeated_role_tags_do_not_become_speech_turns():
    arabic = "هذه جملة عربية طويلة لشرح الدرس دون وقفات مصطنعة. " * 5
    lesson = parse_lesson(f"[1] {arabic}[/1][1] نهاية الشرح.[/1][2] Thank you.[/2]", dialogue=True)
    assert len(lesson.steps) == 1
    assert len(lesson.steps[0].rows) > 2
    speech = lesson.steps[0].speech(True)
    assert speech.count("[1]") == speech.count("[2]") == 1
    assert " ".join(arabic.split()) in speech
    assert "نهاية الشرح." in speech
    assert len(merge_turns(parse_dialogue(speech))) == 2


def test_single_narrator_visual_rows_are_joined_without_artificial_paragraph_pauses():
    lesson = parse_lesson("# Lesson\n## Step\nHello.\nAnother sentence.")
    assert lesson.steps[0].speech(False) == "Hello. Another sentence."
    assert lesson.spoken_script == "Hello.\nAnother sentence."  # Stable readable transcript.


@pytest.mark.parametrize("prefix", ["1.", "2)", "٣.", "٤)"])
def test_numbered_prefix_before_an_explicit_span_has_unambiguous_ownership(prefix):
    assert parse_dialogue(f"{prefix} [2] Hello.[/2][1] مرحبًا.[/1]") == [
        DialogueTurn(2, f"{prefix} Hello."),
        DialogueTurn(1, "مرحبًا."),
    ]


@pytest.mark.parametrize("script", ["Note: [2] Hello.[/2]", "1. [3] Hello.", "1. [/2] Hello."])
def test_numbered_support_does_not_make_unknown_unassigned_or_orphan_prose_valid(script):
    with pytest.raises(ScriptError):
        parse_dialogue(script)


def test_fill_in_exercises_stay_visible_without_inventing_spoken_answers():
    text = "My name is ............ and I am ____ years old. —"
    lesson = parse_lesson(text)
    assert lesson.steps[0].rows[0].text == text
    spoken = lesson.steps[0].speech(False)
    assert spoken == "My name is … and I am … years old."
    assert narration_text(spoken) == spoken
    assert "Ahmed" not in spoken and "10" not in spoken


def test_pair_boundary_moves_english_to_next_page_instead_of_separating_its_arabic():
    lines = ["[1] مقدمة."] * 5 + ["[2] Hello.", "[1] مرحبًا."]
    lesson = parse_lesson("\n".join(lines), dialogue=True)
    assert [len(step.rows) for step in lesson.steps] == [5, 2]
    assert [row.text for row in lesson.steps[1].rows] == ["Hello.", "مرحبًا."]
    assert all(len(step.rows) <= ROWS_PER_STEP for step in lesson.steps)


def test_historical_six_row_manifest_is_still_strictly_verified(tmp_path):
    script = "\n".join(["[1] مقدمة."] * 5 + ["[2] Hello.", "[1] مرحبًا."])
    legacy = parse_lesson(script, dialogue=True, _pair_pages=False)
    assert [len(step.rows) for step in legacy.steps] == [6, 1]
    path = tmp_path / "historical.html"
    path.write_text(whiteboard_html(legacy), encoding="utf-8")
    assert WhiteboardPage.load(path).lesson.manifest() == legacy.manifest()
    altered = legacy.manifest()
    altered["steps"][0]["rows"][0]["text"] = "changed"
    content = path.read_text(encoding="utf-8")
    original = json.dumps(legacy.manifest(), ensure_ascii=True, separators=(",", ":"))
    assert original in content
    path.write_text(content.replace(original, json.dumps(altered)), encoding="utf-8")
    with pytest.raises(WhiteboardError):
        WhiteboardPage.load(path)


def test_maximum_size_historical_board_still_loads_if_new_pairing_needs_more_pages(tmp_path):
    script = "\n".join("[1] مرحبًا." if index % 6 == 0 else "[2] Hello." for index in range(720))
    legacy = parse_lesson(script, dialogue=True, _pair_pages=False)
    assert len(legacy.steps) == 120
    with pytest.raises(WhiteboardError):
        parse_lesson(script, dialogue=True)
    path = tmp_path / "historical-maximum.html"
    path.write_text(whiteboard_html(legacy), encoding="utf-8")
    assert WhiteboardPage.load(path).lesson.manifest() == legacy.manifest()


@pytest.mark.parametrize("layout", ["stacked", "columns", "script"])
def test_layout_round_trips_without_changing_lesson_or_row_colors(tmp_path, layout):
    lesson = parse_lesson("[2] Hello.[/2][1] مرحبًا.[/1]", dialogue=True)
    style = BoardAppearance(layout=layout, row_colors=(RowColor(0, 0, "#475569"),))
    path = tmp_path / "layout.html"
    path.write_text(whiteboard_html(lesson, appearance=style), encoding="utf-8")
    page = WhiteboardPage.load(path)
    assert page.appearance == style
    assert page.lesson.manifest() == lesson.manifest()


@pytest.mark.parametrize("layout", [None, [], 1, "grid", "url(evil)"])
def test_unknown_layout_values_cannot_become_css_or_script(layout):
    with pytest.raises(AppearanceError):
        BoardAppearance.from_data(BoardAppearance().to_data() | {"layout": layout}, (2,))


def test_earlier_color_only_metadata_loads_with_its_existing_script_order():
    data = BoardAppearance(first_character="layla").to_data()
    del data["layout"]
    assert BoardAppearance.from_data(data, (2,)) == replace(
        BoardAppearance(first_character="layla"), layout="script"
    )


def test_bundled_customized_example_is_also_generated_from_the_current_template():
    path = Path(__file__).parents[1] / "examples" / "greetings-kids.html"
    page = WhiteboardPage.load(path)
    assert page.appearance.first_character != "none"
    assert path.read_text(encoding="utf-8-sig") == whiteboard_html(
        page.lesson, appearance=page.appearance
    )


def test_real_offline_fixture_has_one_reply_gap_not_a_gap_for_repeated_role_tags(
    tmp_path, bilingual_cast
):
    result = SpeechEngine().render_dialogue(
        "[1] مرحبًا.[/1][1] أهلاً بكم.[/1][2] Hello.[/2]",
        bilingual_cast,
        tmp_path / "same-role.wav",
        RenderOptions(),
        turn_pause_ms=350,
    )
    # Piper emits one second per sentence with this silent fixture: three
    # sentences + one real transition, not a second artificial same-role gap.
    assert result.duration_seconds == pytest.approx(3.35, abs=0.001)


def test_narration_cleanup_cannot_bypass_the_original_script_size_limit(tmp_path, voice_spec):
    with pytest.raises(ScriptError, match="100,000"):
        SpeechEngine().render(
            "Hello " + "." * 100_000, voice_spec, tmp_path / "oversized.wav", RenderOptions()
        )
