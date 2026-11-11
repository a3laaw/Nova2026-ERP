"""Untrusted plan validation, backward compatibility and speech/timing binding."""

import copy
import json
import re
from dataclasses import asdict, replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from nova_voice.engine import DialogueVoice, RenderOptions, SpeechEngine
from nova_voice.scene_examples import VISUAL_EXAMPLE, example_plan
from nova_voice.scenes import (
    MAX_PLAN_BYTES,
    SceneError,
    VisualPlan,
    calculation_result,
    empty_plan,
    load_plan_json,
    review_text,
    source_manifest,
)
from nova_voice.timing import data_fingerprint
from nova_voice.voices import VoiceError, VoiceSpec
from nova_voice.whiteboard import (
    AUDIO_MARKER,
    WhiteboardError,
    WhiteboardPage,
    _safe_json,
    parse_lesson,
    render_whiteboard_audio,
    render_whiteboard_with_audio,
    save_whiteboard,
    validate_lesson_cast,
    whiteboard_html,
)


def fixture_lesson():
    return parse_lesson("# Numbers 😀\n## Addition\n2\n+ 3\n= 5\n## Shapes\nA right triangle.")


def fixture_plan():
    source = fixture_lesson().manifest()
    data = empty_plan(source, subject="Math", grade="Any grade")
    data["steps"][0]["rows"] = [
        {"index": 0, "display": "2", "speech": "Two apples."},
        {"index": 1, "display": "+ 3", "speech": "Add three apples."},
        {"index": 2, "display": "= 5", "speech": "There are five apples."},
    ]
    data["steps"][0]["elements"] = [
        {
            "kind": "icons",
            "row": 0,
            "x": 100,
            "y": 100,
            "icon": "apple",
            "count": 2,
            "columns": 2,
            "size": 80,
        },
        {"kind": "calculation", "row": 2, "x": 500, "y": 300, "a": 2, "b": 3, "op": "+"},
    ]
    return data, source


def test_plain_schema1_is_exactly_the_historical_payload_and_fingerprint():
    lesson = fixture_lesson()
    old = {
        "schema": 1,
        "script": lesson.script,
        "title": lesson.title,
        "dialogue": lesson.dialogue,
        "steps": [asdict(step) for step in lesson.steps],
    }
    old = json.loads(json.dumps(old))
    assert lesson.manifest() == old | {"fingerprint": data_fingerprint(old)}
    assert "visuals" not in lesson.manifest()
    assert lesson.spoken_script == "2\n+ 3\n= 5\nA right triangle."


def test_schema2_roundtrip_retains_source_and_independent_narration(tmp_path):
    data, source = fixture_plan()
    lesson = replace(fixture_lesson(), visuals=VisualPlan.from_data(data, source))
    path = tmp_path / "lesson.html"
    save_whiteboard(lesson, path)
    saved = WhiteboardPage.load(path).lesson
    assert saved == lesson
    assert saved.manifest()["schema"] == 2
    assert source_manifest(saved) == source
    assert saved.script == source["script"]
    assert saved.steps[0].rows[0].text == "2"
    assert saved.effective_rows(0)[0].text == "2"
    assert saved.effective_rows(0, speech=True)[0].text == "Two apples."
    assert saved.step_speech(0) == "Two apples. Add three apples. There are five apples."
    assert saved.characters == len(
        "Two apples.Add three apples.There are five apples.A right triangle."
    )
    assert "النطق: Two apples." in review_text(saved.visuals, source)
    assert "2 + 3 = 5" in review_text(saved.visuals, source)


def test_plan_is_an_immutable_snapshot_and_to_data_returns_a_copy():
    data, source = fixture_plan()
    plan = VisualPlan.from_data(data, source)
    before = plan.payload_json
    data["steps"][0]["rows"][0]["speech"] = "Changed!"
    plan.to_data()["steps"][0]["rows"][0]["speech"] = "Changed!"
    assert plan.payload_json == before
    assert plan.row_text(0, 0, "2", speech=True) == "Two apples."


@pytest.mark.parametrize("part", ["display", "speech", "drawing", "description", "source"])
def test_approved_content_changes_the_timing_bound_lesson_fingerprint(part):
    data, source = fixture_plan()
    original = replace(fixture_lesson(), visuals=VisualPlan.from_data(data, source))
    if part in ("display", "speech"):
        data["steps"][0]["rows"][0][part] += " more"
    elif part == "drawing":
        data["steps"][0]["elements"][0]["x"] += 1
    elif part == "description":
        data["steps"][0]["description"] += " more"
    else:
        other = parse_lesson(fixture_lesson().script + "\nAnother row.")
        with pytest.raises(SceneError):
            VisualPlan.from_data(data, other.manifest())
        return
    changed = replace(fixture_lesson(), visuals=VisualPlan.from_data(data, source))
    assert changed.manifest()["fingerprint"] != original.manifest()["fingerprint"]


@pytest.mark.parametrize(
    "change",
    [
        "schema",
        "boolean-schema",
        "source",
        "unknown-root",
        "missing-step",
        "step-order",
        "extra-step",
        "unknown-step",
        "missing-description",
        "duplicate-row",
        "wrong-row",
        "boolean-row",
        "empty-speech",
        "long-speech",
        "long-display",
        "changed-speaker",
        "non-list-notes",
        "long-notes",
        "unknown-policy",
        "too-many-elements",
    ],
)
def test_invalid_plans_fail_closed(change):
    data, source = fixture_plan()
    step = data["steps"][0]
    if change == "schema":
        data["schema"] = 2
    elif change == "boolean-schema":
        data["schema"] = True
    elif change == "source":
        data["source_fingerprint"] = "a" * 64
    elif change == "unknown-root":
        data["code"] = "alert(1)"
    elif change == "missing-step":
        data["steps"].pop()
    elif change == "step-order":
        step["index"] = 1
    elif change == "extra-step":
        data["steps"].append(copy.deepcopy(step))
    elif change == "unknown-step":
        step["svg"] = "<svg/>"
    elif change == "missing-description":
        del step["description"]
    elif change == "duplicate-row":
        step["rows"].append(step["rows"][0])
    elif change == "wrong-row":
        step["rows"][0]["index"] = 5
    elif change == "boolean-row":
        step["rows"][0]["index"] = False
    elif change == "empty-speech":
        step["rows"][0]["speech"] = " "
    elif change == "long-speech":
        step["rows"][0]["speech"] = "a" * 481
    elif change == "long-display":
        step["rows"][0]["display"] = "a" * 181
    elif change == "changed-speaker":
        step["rows"][0]["speaker"] = 2
    elif change == "non-list-notes":
        data["notes"] = "hello"
    elif change == "long-notes":
        data["notes"] = ["a"] * 13
    elif change == "unknown-policy":
        data["policy"] = "verified-quran"
    elif change == "too-many-elements":
        step["elements"] *= 31
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source)


VALID_ELEMENTS = [
    {"kind": "rect", "w": 200, "h": 100},
    {"kind": "circle", "r": 30},
    {"kind": "ellipse", "rx": 50, "ry": 20},
    {"kind": "line", "x2": 500, "y2": 150},
    {"kind": "arrow", "x2": 500, "y2": 150},
    {"kind": "polygon", "points": [[100, 20], [300, 20], [200, 100]]},
    {"kind": "polyline", "points": [[100, 20], [300, 100]]},
    {"kind": "path", "d": "M10 20C30.5 40 70 20 100 60Z"},
    {"kind": "text", "text": 'a < b & "quoted" 😀', "direction": "ltr"},
    {"kind": "icons", "icon": "apple", "count": 0, "columns": 2, "size": 80},
    {"kind": "right_triangle", "a": 3, "b": 4, "w": 300, "h": 200},
    {"kind": "calculation", "a": 2, "b": 3, "op": "+"},
]


@pytest.mark.parametrize("element", VALID_ELEMENTS)
def test_every_declarative_primitive_can_be_imported_without_subject_templates(element):
    data, source = fixture_plan()
    data["steps"][0]["elements"] = [dict(row=0, x=100, y=100, **element)]
    VisualPlan.from_data(data, source)


@pytest.mark.parametrize(
    "change",
    [
        {"kind": "script"},
        {"kind": "image", "href": "https://example.com"},
        {"onclick": "alert(1)"},
        {"fill": "url(https://example.com)"},
        {"stroke": "red"},
        {"x": -1},
        {"x": 1001},
        {"x": 1.0},
        {"x": True},
        {"x": None},
        {"row": -1},
        {"row": 3},
        {"until": 0},
        {"until": 4},
        {"dx": 1001},
        {"line_width": 0},
        {"count": 21},
        {"count": -1},
        {"columns": 0},
        {"size": 101},
        {"icon": "https://example.com/apple.svg"},
    ],
)
def test_untrusted_attributes_coordinates_counts_and_urls_are_rejected(change):
    data, source = fixture_plan()
    data["steps"][0]["elements"][0].update(change)
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source)


@pytest.mark.parametrize(
    "path",
    [
        "<svg onload=alert(1)>",
        "M0 0L1e999 2",
        "M0 0L999999 2",
        "M0 0 javascript:1",
        "M" + "1 " * 401,
    ],
)
def test_paths_are_bounded_numerical_data_not_svg_markup(path):
    data, source = fixture_plan()
    data["steps"][0]["elements"] = [{"kind": "path", "row": 0, "x": 0, "y": 0, "d": path}]
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source)


@pytest.mark.parametrize(
    "text",
    [
        '{"schema":1,"schema":1}',
        '{"x":NaN}',
        '{"x":Infinity}',
        '{"x":-Infinity}',
        "[]",
        "<svg/>",
        "{} explanation",
    ],
)
def test_strict_json_rejects_ambiguous_or_executable_input(text):
    with pytest.raises(SceneError):
        load_plan_json(text)


def test_optional_whole_json_fence_and_bounded_file_import(tmp_path):
    data, source = fixture_plan()
    plan = VisualPlan.from_json("```json\n" + json.dumps(data) + "\n```", source)
    assert plan.to_data() == data
    path = tmp_path / "too-big.json"
    path.write_bytes(b" " * (MAX_PLAN_BYTES + 1))
    with pytest.raises(SceneError):
        VisualPlan.load(path, source)


@pytest.mark.parametrize(
    "a,b,op,result",
    [
        (2, 3, "+", "5"),
        (2, 3, "-", "-1"),
        (3, 4, "*", "12"),
        (2, 3, "/", "2/3"),
        (3, -6, "/", "-1/2"),
        (0, 5, "/", "0"),
    ],
)
def test_four_explicit_computations_without_eval(a, b, op, result):
    assert calculation_result(a, b, op) == result


def test_no_division_by_zero_or_model_supplied_result():
    data, source = fixture_plan()
    item = data["steps"][0]["elements"][1]
    item.update(op="/", b=0)
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source)
    item.update(op="+", b=3, result=500)
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source)


def test_sacred_policy_preserves_text_and_blocks_automatic_speech():
    lesson = parse_lesson("# نص للمراجعة\nنص كما كتبه المعلم.")
    data = empty_plan(lesson.manifest())
    data["policy"] = "sacred"
    plan = VisualPlan.from_data(data, lesson.manifest())
    visual = replace(lesson, visuals=plan)
    assert visual.spoken_script == lesson.spoken_script
    with pytest.raises(VoiceError, match="Piper"):
        validate_lesson_cast(visual, {}, RenderOptions())
    data["steps"][0]["rows"] = [{"index": 0, "display": "نص آخر", "speech": "نص آخر"}]
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, lesson.manifest())
    data["steps"][0]["rows"] = []
    data["steps"][0]["elements"] = [{"kind": "circle", "row": 0, "x": 100, "y": 100, "r": 40}]
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, lesson.manifest())


def test_markup_is_escaped_in_json_noscript_and_description():
    data, source = fixture_plan()
    hostile = "</script><script>window.hacked=true</script><img src=x onerror=alert(1)>"
    data["steps"][0]["description"] = hostile
    data["steps"][0]["rows"][0]["display"] = hostile
    content = whiteboard_html(replace(fixture_lesson(), visuals=VisualPlan.from_data(data, source)))
    assert hostile not in content
    assert "&lt;script&gt;window.hacked=true&lt;/script&gt;" in content
    assert "\\u003c/script>" in content


class MeasuredEngine(SpeechEngine):
    def __init__(self):
        super().__init__()
        self.inputs = []

    def _load(self, spec):
        def synthesize(text, syn_config):
            self.inputs.append(text)
            return iter(
                [
                    SimpleNamespace(
                        sample_rate=8000,
                        sample_width=2,
                        sample_channels=1,
                        audio_int16_bytes=bytes(800),
                    )
                ]
            )

        return SimpleNamespace(
            config=SimpleNamespace(sample_rate=8000, length_scale=1.0), synthesize=synthesize
        )


def test_streaming_export_speaks_only_reviewed_narration_and_binds_audio(tmp_path, voice_files):
    data, source = fixture_plan()
    lesson = replace(fixture_lesson(), visuals=VisualPlan.from_data(data, source))
    voice = replace(VoiceSpec.from_path(voice_files[0]), sample_rate=8000)
    engine, path = MeasuredEngine(), tmp_path / "voiced.html"
    render_whiteboard_with_audio(
        engine, lesson, {1: DialogueVoice(voice)}, path, RenderOptions(), audio_format="wav"
    )
    assert engine.inputs == [
        "Two apples.",
        "Add three apples.",
        "There are five apples.",
        "A right triangle.",
    ]
    saved = WhiteboardPage.load(path, allow_recordings=True)
    assert saved.lesson == lesson
    assert saved.timing.lesson_fingerprint == lesson.manifest()["fingerprint"]
    assert [line.line_id for line in saved.timing.steps[0].lines] == [0, 1, 2]
    assert "2" not in engine.inputs
    content = path.read_text(encoding="utf-8-sig")
    data["steps"][0]["rows"][0]["speech"] = "A different sentence."
    changed = replace(lesson, visuals=VisualPlan.from_data(data, source))
    content = re.sub(
        r'(<script id="nova-whiteboard-data" type="application/json">).*?(</script>)',
        lambda m: m[1] + _safe_json(changed.manifest()) + m[2],
        content,
        flags=re.S,
    )
    path.write_text(content, encoding="utf-8")
    with pytest.raises(WhiteboardError):
        WhiteboardPage.load(path, allow_recordings=True)


def test_unmeasured_legacy_engine_cannot_misalign_visual_narration(tmp_path, voice_files):
    data, source = fixture_plan()
    lesson = replace(fixture_lesson(), visuals=VisualPlan.from_data(data, source))
    silent, destination = tmp_path / "silent.html", tmp_path / "audio.html"
    save_whiteboard(lesson, silent)
    voice = VoiceSpec.from_path(voice_files[0])
    with pytest.raises(WhiteboardError, match="توقيت"):
        render_whiteboard_audio(
            object(), silent, {1: DialogueVoice(voice)}, destination, RenderOptions()
        )
    assert not destination.exists()


def test_local_demo_is_honest_and_reproducible():
    lesson = parse_lesson(VISUAL_EXAMPLE)
    plan = example_plan(lesson.manifest())
    assert len(plan.to_data()["steps"]) == 3
    assert "ليست نتيجة استدعاء" in plan.to_data()["notes"][0]
    assert plan.to_data()["steps"][0]["elements"][2]["count"] == 3
    exported = Path(__file__).parents[1] / "examples" / "visual-scenes.html"
    assert exported.is_file()
    assert exported.read_text(encoding="utf-8-sig") == whiteboard_html(
        replace(lesson, visuals=plan)
    )


@pytest.mark.parametrize("speech", ["___", "...", "+", "[2] Hello", "[/1] Hello", "\ud800"])
def test_every_proposed_speech_row_must_remain_voiced_without_role_markers(speech):
    data, source = fixture_plan()
    data["steps"][0]["rows"][0]["speech"] = speech
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source)


def test_json_plan_save_is_atomic_and_roundtrips_without_implicit_approval(tmp_path):
    data, source = fixture_plan()
    plan = VisualPlan.from_data(data, source)
    path = tmp_path / "plan.json"
    plan.save(path)
    assert VisualPlan.load(path, source) == plan
    assert not list(tmp_path.glob(".nova-scene-plan-*"))
    assert "approved" not in path.read_text(encoding="utf-8")


def test_near_limit_plans_export_compactly_if_pretty_whitespace_would_be_too_large(tmp_path):
    # 120 steps, 720 stable source rows; plan text remains below original limits.
    script = "# Large\n" + "\n".join(
        f"## Step {i}\n" + "\n".join(["X" * 100] * 6) for i in range(120)
    )
    lesson = parse_lesson(script)
    source = lesson.manifest()
    data = empty_plan(source)
    for step in data["steps"]:
        step["description"] = "d" * 400
        step["rows"] = [
            {"index": row, "display": "x" * 180, "speech": "s" * 440} for row in range(6)
        ]
    # Above would exceed the voiced character budget. Use display/descriptions
    # and bounded paths instead to exercise byte size independently of speech.
    for step in data["steps"]:
        step["rows"] = [
            {"index": row, "display": "x" * 180, "speech": "Spoken."} for row in range(6)
        ]
    element = {"kind": "path", "row": 0, "x": 0, "y": 0, "d": "M0 0" + " L1 1" * 300}
    for step in data["steps"]:
        step["elements"] = [copy.deepcopy(element)]
    # Grow descriptions/paths to near the canonical size bound, not past it.
    # The path number bound is 400, so use spaces as valid bounded padding.
    for step in data["steps"]:
        step["elements"][0]["d"] = "M0 0L1 1" + " " * 1900
    for step in data["steps"][:15]:
        step["elements"].append(copy.deepcopy(step["elements"][0]))
    plan = VisualPlan.from_data(data, source)
    assert len(json.dumps(data, ensure_ascii=False, indent=2).encode()) > MAX_PLAN_BYTES
    assert len(plan.to_json().encode()) <= MAX_PLAN_BYTES
    assert plan.to_json() == plan.payload_json
    path = tmp_path / "large.json"
    plan.save(path)
    assert VisualPlan.load(path, source) == plan


def test_cli_import_requires_explicit_approval_before_writing(tmp_path, monkeypatch, capsys):
    from nova_voice.whiteboard import main

    data, source = fixture_plan()
    script, planfile, output = (
        tmp_path / "source.txt",
        tmp_path / "plan.json",
        tmp_path / "board.html",
    )
    script.write_text(fixture_lesson().script, encoding="utf-8")
    VisualPlan.from_data(data, source).save(planfile)
    monkeypatch.setattr(
        "sys.argv", ["whiteboard", str(script), str(output), "--scene-plan", str(planfile)]
    )
    with pytest.raises(SystemExit) as error:
        main()
    assert error.value.code == 2 and not output.exists()
    assert "النطق: Two apples." in capsys.readouterr().out
    monkeypatch.setattr(
        "sys.argv",
        ["whiteboard", str(script), str(output), "--scene-plan", str(planfile), "--approve-scenes"],
    )
    main()
    assert WhiteboardPage.load(output).lesson.manifest()["schema"] == 2


def test_optional_ui_sources_compile_even_when_native_qt_cannot_be_imported():
    import warnings

    root = Path(__file__).parents[1] / "nova_voice"
    with warnings.catch_warnings():
        warnings.simplefilter("error", SyntaxWarning)
        for name in ("ui.py", "scene_picker.py", "lesson_picker.py", "appearance_picker.py"):
            compile((root / name).read_text(encoding="utf-8"), str(root / name), "exec")


def test_sacred_policy_cannot_add_generated_scripture_in_scene_descriptions():
    source = parse_lesson("# عنوان أصلي\nنص كما كتبه المعلم.").manifest()
    data = empty_plan(source)
    data["policy"] = "sacred"
    data["steps"][0]["description"] = "تعليق أو اقتباس جديد من النموذج"
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source)


def test_protected_local_html_does_not_accept_an_injected_audio_node(tmp_path):
    source = fixture_lesson().manifest()
    data = empty_plan(source)
    data["policy"] = "sacred"
    lesson = replace(fixture_lesson(), visuals=VisualPlan.from_data(data, source))
    html = (
        whiteboard_html(lesson)
        .replace(AUDIO_MARKER, "")
        .replace(
            "</body>",
            '<script id="nova-whiteboard-recordings" type="application/json">{}</script></body>',
        )
    )
    path = tmp_path / "protected.html"
    path.write_text(html, encoding="utf-8")
    with pytest.raises(WhiteboardError, match="المقدسة"):
        WhiteboardPage.load(path, allow_recordings=True)
