"""Owned composition/pose contracts; authored vectors are NOT live AI inference."""

import copy
import json
from dataclasses import replace
from pathlib import Path

import pytest

from nova_voice.lesson_draft import LessonDraft
from nova_voice.lesson_planner import DRAWING_RULES, LESSON_PROMPT
from nova_voice.scene_graph import (
    curve_position,
    sequence_state,
    sphere_point,
    validate_elements,
    walk_elements,
)
from nova_voice.scene_planner import SYSTEM_PROMPT, manual_prompt
from nova_voice.scenes import SceneError, VisualPlan, empty_plan, review_text
from nova_voice.text import ScriptError
from nova_voice.whiteboard import WhiteboardPage, parse_lesson, save_whiteboard, whiteboard_html

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((ROOT / "tests/fixtures/graph-cases.json").read_text())


def lesson():
    return parse_lesson("# Source\nOne cue.\nAnother cue.\nLast cue.")


@pytest.mark.parametrize("case", CASES["valid"], ids=lambda case: case["id"])
def test_composable_elements_validate_round_trip_and_preserve_source(tmp_path, case):
    source = lesson()
    data = empty_plan(source.manifest())
    data["steps"][0]["elements"] = case["elements"]
    plan = VisualPlan.from_data(data, source.manifest())
    assert validate_elements(case["elements"], CASES["rows"]) <= 60
    illustrated = replace(source, visuals=plan)
    assert illustrated.spoken_script == source.spoken_script
    assert illustrated.speakers == source.speakers
    assert illustrated.script == source.script
    assert illustrated.manifest()["steps"] == source.manifest()["steps"]
    save_whiteboard(illustrated, tmp_path / "composition.html")
    assert WhiteboardPage.load(tmp_path / "composition.html").lesson == illustrated
    assert VisualPlan.from_json(plan.to_json(), source.manifest()) == plan


@pytest.mark.parametrize("case", CASES["invalid"], ids=lambda case: case["id"])
def test_shared_invalid_composition_vectors_fail_closed(case):
    with pytest.raises(SceneError):
        validate_elements(case["elements"], CASES["rows"])
    data = empty_plan(lesson().manifest())
    data["steps"][0]["elements"] = case["elements"]
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, lesson().manifest())


@pytest.mark.parametrize("case", CASES["math"]["curves"])
def test_bezier_math_is_bounded_by_progress_and_not_claimed_constant_speed(case):
    assert curve_position(case["points"], case["fraction"]) == pytest.approx(case["expected"])


@pytest.mark.parametrize("case", CASES["math"]["sequences"])
def test_sequence_pose_and_color_rounding_share_js_vectors(case):
    actual = sequence_state(case["motion"], case["fraction"])
    for key, value in case["expected"].items():
        assert actual[key] == (value if key == "fill" else pytest.approx(value))
    assert actual == sequence_state(case["motion"], case["fraction"])


@pytest.mark.parametrize("case", CASES["math"]["spheres"])
def test_orthographic_projection_and_back_hemisphere_share_js_vectors(case):
    assert sphere_point(
        case["longitude"], case["latitude"], case["spin"], case["tilt"]
    ) == pytest.approx(case["expected"], abs=1e-9)


def test_aggregate_step_total_counts_nested_parts_not_only_wrappers():
    source = parse_lesson("# Large\n" + "\n".join(f"## S{i}\nOne row." for i in range(11)))
    data = empty_plan(source.manifest())
    primitive = {"kind": "circle", "row": 0, "x": 10, "y": 10, "r": 5}
    # Three top-level groups hide 57 nodes in every step: 627, not 33.
    group = dict(kind="group", row=0, x=0, y=0, name="parts", children=[primitive] * 18)
    for step in data["steps"]:
        step["elements"] = [group] * 3
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source.manifest())
    data["steps"].pop()
    smaller = parse_lesson("# Large\n" + "\n".join(f"## S{i}\nOne row." for i in range(10)))
    data["source_fingerprint"] = smaller.manifest()["fingerprint"]
    assert VisualPlan.from_data(data, smaller.manifest())


def test_full_lesson_draft_also_counts_nested_parts_and_binding_cannot_bypass_it():
    original = LessonDraft.load(ROOT / "examples/complete-lesson-demo.json")
    data = original.to_data()
    primitive = {"kind": "circle", "row": 0, "x": 10, "y": 10, "r": 5}
    group = dict(kind="group", row=0, x=0, y=0, name="parts", children=[primitive] * 18)
    for step in data["draft"]["steps"]:
        step["elements"] = [group] * 3
    with pytest.raises(ScriptError, match="180"):
        LessonDraft.from_data(data, original.brief)
    compiled = original.compile()
    source = replace(compiled, visuals=None)
    plan = empty_plan(
        source.manifest(), subject=data["brief"]["subject"], grade=data["brief"]["grade"]
    )
    for step in plan["steps"]:
        step["elements"] = [group] * 3
    checked = VisualPlan.from_data(plan, source.manifest())
    with pytest.raises(ScriptError, match="180"):
        original.bind_plan(checked, source)


def test_nested_lifetimes_inherit_and_sequences_cannot_run_outside_parent():
    primitive = dict(kind="circle", row=0, x=10, y=10, r=5)
    group = dict(kind="group", row=0, x=0, y=0, name="parent", until=1, children=[primitive])
    assert validate_elements([group], 3) == 2
    group["children"][0]["until"] = 2
    with pytest.raises(SceneError):
        validate_elements([group], 3)


def test_review_exposes_nested_meaningful_names_motion_and_illustrative_sphere_limits():
    page = WhiteboardPage.load(ROOT / "examples/composition-demo.html")
    source = replace(page.lesson, visuals=None)
    text = review_text(page.lesson.visuals, source.manifest())
    assert "جسم ذو أطراف مترابطة" in text and "مفصل سفلي 4" in text
    assert "حركة sequence" in text and "2 دورات" in text
    assert "إسقاط كروي توضيحي 2.5D، لا خريطة معتمدة" in text
    assert all(row.text in text for step in source.steps for row in step.rows)


def test_authored_demo_is_reproducible_and_uses_composition_not_hidden_templates():
    script = (ROOT / "examples/composition-demo-script.txt").read_text()
    source = parse_lesson(script)
    plan = VisualPlan.load(ROOT / "examples/composition-demo.json", source.manifest())
    content = (ROOT / "examples/composition-demo.html").read_text(encoding="utf-8-sig")
    illustrated = replace(source, visuals=plan)
    assert content == whiteboard_html(illustrated)
    assert WhiteboardPage.load(ROOT / "examples/composition-demo.html").lesson == illustrated
    data = plan.to_data()
    all_nodes = [e for step in data["steps"] for e in walk_elements(step["elements"])]
    assert {"group", "sphere", "sector"} <= {e["kind"] for e in all_nodes}
    assert {"curve", "sequence"} <= {e.get("motion", {}).get("type") for e in all_nodes}
    assert "مؤلف يدويًا" in data["notes"][0] and "ليس استجابة نموذج" in data["notes"][0]
    assert "ترتيب عرض، لا عملية تكوّن حيوية" in source.spoken_script
    assert all("href" not in e and "template" not in e and "asset" not in e for e in all_nodes)


def test_extended_prompt_is_script_first_and_reused_by_complete_lesson_planner():
    source = lesson().manifest()
    prompt = manual_prompt(source, "مادة جديدة", "الثاني الإعدادي")
    assert "SCRIPT, not a teacher selecting" in prompt
    assert "keyword routing or required component picker" in prompt
    assert "articulated movement" in prompt and "biological formation" in prompt
    assert all(name + ":" in DRAWING_RULES for name in ("group", "sphere", "sector"))
    assert 'type:"curve"' in DRAWING_RULES and 'type:"sequence"' in DRAWING_RULES
    assert DRAWING_RULES in LESSON_PROMPT and "Sacred policy requires" not in DRAWING_RULES
    assert source["fingerprint"] in prompt and "الثاني الإعدادي" in prompt
    assert "No independent durations/timers" in SYSTEM_PROMPT


def test_sacred_rules_and_exact_source_binding_are_not_relaxed_by_composition():
    source = lesson().manifest()
    data = empty_plan(source)
    data["policy"] = "sacred"
    data["steps"][0]["elements"] = copy.deepcopy(CASES["valid"][16]["elements"])
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source)
    data["policy"] = "general"
    data["source_fingerprint"] = "0" * 64
    with pytest.raises(SceneError, match="سكريبت"):
        VisualPlan.from_data(data, source)


def test_composition_labels_and_keyframes_are_not_narration_or_voice_selection():
    source = parse_lesson(
        "# Dialogue\n[1] The first speaker.\n[2] The second speaker.", dialogue=True
    )
    data = empty_plan(source.manifest())
    data["steps"][0]["elements"] = [
        dict(
            kind="group",
            row=0,
            x=0,
            y=0,
            name="Nonspoken joint description",
            children=[dict(kind="text", row=1, x=100, y=100, text="Nonspoken diagram label")],
        )
    ]
    plan = VisualPlan.from_data(data, source.manifest())
    illustrated = replace(source, visuals=plan)
    assert illustrated.spoken_script == source.spoken_script
    assert illustrated.speakers == {1, 2}
    assert "Nonspoken" not in illustrated.spoken_script
    assert source.manifest()["fingerprint"] == plan.to_data()["source_fingerprint"]
    assert source.manifest()["fingerprint"] != illustrated.manifest()["fingerprint"]


def test_full_lesson_can_compile_composition_without_losing_exact_original_brief():
    original = LessonDraft.load(ROOT / "examples/complete-lesson-demo.json")
    response = original.to_data()["draft"]
    response["steps"][0]["elements"] = copy.deepcopy(
        next(case for case in CASES["valid"] if case["id"] == "named-group")["elements"]
    )
    compiled = LessonDraft.from_response(response, original.brief).compile()
    assert compiled.visuals.to_data()["origin"]["brief"] == original.brief.to_data()
    assert compiled.spoken_script == original.compile().spoken_script
    assert compiled.visuals.to_data()["steps"][1]["elements"][0]["kind"] == "group"
    assert (
        compiled.visuals.to_data()["origin"]["draft_fingerprint"]
        != (original.compile().visuals.to_data()["origin"]["draft_fingerprint"])
    )


def test_full_lesson_binding_validates_before_traversing_a_directly_wrapped_tree():
    original = LessonDraft.load(ROOT / "examples/complete-lesson-demo.json")
    source = replace(original.compile(), visuals=None)
    data = empty_plan(source.manifest())
    part = dict(kind="circle", row=0, x=0, y=0, r=1)
    for _ in range(20):
        part = dict(kind="group", row=0, x=0, y=0, name="too deep", children=[part])
    data["steps"][1]["elements"] = [part]
    with pytest.raises(SceneError, match="عمق"):
        original.bind_plan(VisualPlan(json.dumps(data)), source)
