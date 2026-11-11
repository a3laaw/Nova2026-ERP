import json
import re
import wave
from dataclasses import replace
from pathlib import Path

import pytest

from nova_voice.appearance import (
    CHARACTERS,
    STYLE_ID,
    AppearanceError,
    BoardAppearance,
    RowColor,
    character_templates,
    color_value,
)
from nova_voice.engine import DialogueVoice, RenderOptions, RenderResult
from nova_voice.whiteboard import (
    WhiteboardError,
    WhiteboardPage,
    parse_lesson,
    render_whiteboard_audio,
    save_whiteboard,
    whiteboard_html,
)


def style_data(content):
    return json.loads(
        re.search(
            rf'<script id="{STYLE_ID}" type="application/json">(.*?)</script>', content, re.S
        )[1]
    )


@pytest.mark.parametrize("value", ["#2563eb", "#C2410C", "#475569"])
def test_colors_are_normalized_without_accepting_css(value):
    assert color_value(value) == value.upper()


@pytest.mark.parametrize(
    "value",
    [None, 4, "red", "#FFF", "#12345678", "url(https://x)", "#2563EB;", "#2563EB\n", "</script>"],
)
def test_non_hex_colors_are_rejected(value):
    with pytest.raises(AppearanceError):
        color_value(value)


def test_appearance_round_trips_colors_character_choices_and_row_overrides():
    appearance = BoardAppearance(
        "#475569", "#C2410C", "adam", "salma", False, (RowColor(0, 1, "#2563EB"),)
    )
    assert BoardAppearance.from_data(appearance.to_data(), (2, 1)) == appearance


@pytest.mark.parametrize(
    "changes",
    [
        {"first_character": "https://example.com/picture.svg"},
        {"second_character": "../evil"},
        {"first_character": None},
        {"animate_characters": "false"},
        {"animate_characters": 0},
        {"version": True},
        {"version": 2},
        {"first_color": "#FFF"},
        {"row_colors": {}},
        {"row_colors": [{"step": 0, "row": 0, "color": "#2563EB"}] * 721},
        {"row_colors": [{"step": True, "row": 0, "color": "#2563EB"}]},
        {"row_colors": [{"step": 1, "row": 0, "color": "#2563EB"}]},
        {"row_colors": [{"step": 0, "row": 3, "color": "#2563EB"}]},
        {"row_colors": [{"step": -1, "row": 0, "color": "#2563EB"}]},
        {"row_colors": [{"step": 0, "row": 0, "color": "#2563EB", "code": "no"}]},
        {"row_colors": [{"step": 0, "row": 0, "color": "#2563EB"}] * 2},
        {"unknown": "ignored settings would be unsafe"},
    ],
)
def test_malformed_or_out_of_lesson_settings_are_rejected(changes):
    data = BoardAppearance().to_data() | changes
    with pytest.raises(AppearanceError):
        BoardAppearance.from_data(data, (2,))


def test_missing_appearance_fields_are_not_silently_accepted():
    data = BoardAppearance().to_data()
    del data["row_colors"]
    with pytest.raises(AppearanceError):
        BoardAppearance.from_data(data, (1,))


def test_local_library_has_three_boys_three_girls_and_only_passive_svg():
    assert [kind for _, _, kind in CHARACTERS].count("boy") == 3
    assert [kind for _, _, kind in CHARACTERS].count("girl") == 3
    assets = Path(__file__).parents[1] / "assets"
    source = character_templates(assets)
    assert source.count("<template") == 6
    assert source.count("<svg ") == 6
    assert "<image" not in source and "href=" not in source and "<script" not in source
    assert "buddy-wave" in source and "buddy-eyes" in source
    assert (
        sum((assets / "characters" / f"{key}.svg").stat().st_size for key, _, _ in CHARACTERS)
        < 25_000
    )


def test_unsafe_or_missing_character_assets_cannot_be_bundled(tmp_path):
    folder = tmp_path / "characters"
    folder.mkdir()
    for key, _, _ in CHARACTERS:
        (folder / f"{key}.svg").write_text(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>bad()</script></svg>'
        , encoding="utf-8")
    with pytest.raises(AppearanceError):
        character_templates(tmp_path)
    (folder / "adam.svg").write_text(
        '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>', encoding="utf-8"
    )
    with pytest.raises(AppearanceError):
        character_templates(tmp_path)


def test_customization_is_saved_separately_from_the_unchanged_lesson_manifest(tmp_path):
    lesson = parse_lesson("# Lesson\n## Step\nHello.\nNext sentence.")
    appearance = BoardAppearance(
        "#475569", "#C2410C", "omar", "layla", True, (RowColor(0, 1, "#2563EB"),)
    )
    source = tmp_path / "custom.html"
    result = save_whiteboard(lesson, source, appearance=appearance)
    loaded = WhiteboardPage.load(source)
    assert loaded.lesson == lesson
    assert loaded.lesson.manifest() == lesson.manifest()
    assert loaded.appearance == result.appearance == appearance
    assert style_data(source.read_text(encoding="utf-8-sig")) == appearance.to_data()
    assert lesson.spoken_script == "Hello.\nNext sentence."


def test_old_styleless_saved_lessons_still_load_without_losing_speech(tmp_path):
    lesson = parse_lesson("## Old lesson\nThe saved words are preserved.")
    source = tmp_path / "legacy.html"
    content = whiteboard_html(lesson)
    content = re.sub(
        rf'<script id="{STYLE_ID}" type="application/json">.*?</script>', "", content, flags=re.S
    )
    source.write_text(content, encoding="utf-8")
    loaded = WhiteboardPage.load(source)
    assert loaded.lesson == lesson
    assert loaded.appearance == BoardAppearance()


@pytest.mark.parametrize(
    "change", ["duplicate", "malformed", "wrong-type", "unsafe", "unknown-character"]
)
def test_bad_style_metadata_is_refused_before_audio_generation(tmp_path, change):
    lesson = parse_lesson("Hello.")
    source = tmp_path / "bad.html"
    content = whiteboard_html(lesson)
    tag = re.search(
        rf'<script id="{STYLE_ID}" type="application/json">.*?</script>', content, re.S
    )[0]
    if change == "duplicate":
        content = content.replace(tag, tag + tag)
    elif change == "malformed":
        content = content.replace(
            tag, f'<script id="{STYLE_ID}" type="application/json">bad json</script>'
        )
    elif change == "wrong-type":
        content = content.replace(
            f'id="{STYLE_ID}" type="application/json"', f'id="{STYLE_ID}" type="text/javascript"'
        )
    else:
        data = BoardAppearance().to_data()
        data["first_color" if change == "unsafe" else "first_character"] = (
            "url(https://bad.invalid)"
        )
        content = content.replace(
            tag, f'<script id="{STYLE_ID}" type="application/json">{json.dumps(data)}</script>'
        )
    source.write_text(content, encoding="utf-8")
    with pytest.raises(WhiteboardError):
        WhiteboardPage.load(source)


def test_styled_lesson_keeps_colors_and_characters_when_narrated(tmp_path, voice_spec):
    lesson = parse_lesson("# Safe lesson\n## Step\nHello children.")
    appearance = BoardAppearance(first_character="adam", row_colors=(RowColor(0, 0, "#475569"),))
    source, output = tmp_path / "silent.html", tmp_path / "narrated.html"
    save_whiteboard(lesson, source, appearance=appearance)
    original = source.read_bytes()
    calls = []

    class Engine:
        def render(self, text, voice, destination, options, cancel, progress):
            calls.append(text)
            with wave.open(str(destination), "wb") as audio:
                audio.setnchannels(1)
                audio.setsampwidth(2)
                audio.setframerate(22050)
                audio.writeframes(bytes(4410))
            return RenderResult(destination, 0.1, len(text))

    render_whiteboard_audio(
        Engine(),
        source,
        {1: DialogueVoice(voice_spec)},
        output,
        RenderOptions(),
        audio_format="wav",
    )
    assert calls == ["Hello children."]
    assert source.read_bytes() == original
    assert style_data(output.read_text(encoding="utf-8-sig")) == appearance.to_data()
    assert output.read_text(encoding="utf-8-sig").count('id="nova-character-adam"') == 1


def test_customization_cannot_change_the_voice_role_or_spoken_words():
    lesson = parse_lesson("## Dialogue\n[2] Hello.[/2][1] مرحبًا.[/1]", dialogue=True)
    first = whiteboard_html(lesson)
    changed = whiteboard_html(
        lesson, replace(BoardAppearance(), first_character="salma", second_character="omar")
    )
    manifest = re.search(
        r'<script id="nova-whiteboard-data" type="application/json">(.*?)</script>', first, re.S
    )[1]
    assert manifest in changed
    assert lesson.spoken_script == "[2] Hello.\n[1] مرحبًا."
