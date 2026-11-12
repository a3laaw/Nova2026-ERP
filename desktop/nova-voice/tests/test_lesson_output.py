"""Output contracts and bounded row-clock animation. No browser/voice claims."""

from copy import deepcopy
from dataclasses import replace
from pathlib import Path

import pytest

from nova_voice.lesson_draft import LessonDraft
from nova_voice.scenes import SceneError, VisualPlan, empty_plan, validate_element
from nova_voice.whiteboard import WhiteboardPage, parse_lesson, save_whiteboard, whiteboard_html

EXAMPLES = Path(__file__).parents[1] / "examples"


def element(motion):
    return {"kind": "circle", "row": 0, "x": 300, "y": 200, "r": 60, "motion": motion}


@pytest.mark.parametrize(
    "motion",
    [
        {"type": "draw"},
        {"type": "none"},
        {"type": "move", "dx": -300, "dy": 180},
        {"type": "move", "dx": 300, "dy": -180},
        {"type": "pulse", "cycles": 1},
        {"type": "pulse", "cycles": 4},
    ],
)
def test_supported_animation_is_declarative_immutable_and_round_trips(tmp_path, motion):
    lesson = parse_lesson("# Local output\nFirst row.\nSecond row.")
    plan = empty_plan(lesson.manifest())
    plan["steps"][0]["elements"] = [element(motion)]
    visual = replace(lesson, visuals=VisualPlan.from_data(plan, lesson.manifest()))
    before = visual.manifest()
    save_whiteboard(visual, tmp_path / "lesson.html")
    assert WhiteboardPage.load(tmp_path / "lesson.html").lesson == visual
    motion["type"] = "none"  # Caller mutation cannot change the approved plan.
    assert visual.manifest() == before
    assert visual.spoken_script == lesson.spoken_script


@pytest.mark.parametrize(
    "motion",
    [
        None,
        True,
        [],
        "draw",
        {},
        {"type": None},
        {"type": ["draw"]},
        {"type": "script"},
        {"type": "draw", "js": "alert(1)"},
        {"type": "none", "seconds": 3},
        {"type": "move", "dx": 0},
        {"type": "move", "dx": True, "dy": 0},
        {"type": "move", "dx": 0.5, "dy": 0},
        {"type": "move", "dx": 301, "dy": 0},
        {"type": "move", "dx": -301, "dy": 0},
        {"type": "move", "dx": 0, "dy": 181},
        {"type": "move", "dx": 0, "dy": -181},
        {"type": "move", "dx": 0, "dy": 0, "duration": 1},
        {"type": "pulse", "cycles": 0},
        {"type": "pulse", "cycles": 5},
        {"type": "pulse", "cycles": True},
        {"type": "pulse", "cycles": None},
        {"type": "pulse", "cycles": 2, "url": "https://example.invalid"},
    ],
)
def test_animation_refuses_executable_unbounded_or_ambiguous_data(motion):
    with pytest.raises(SceneError):
        validate_element(element(motion), 2)


def test_motion_change_invalidates_the_plan_and_timing_bound_lesson_fingerprint():
    lesson = parse_lesson("# Local output\nOne row.")
    plan = empty_plan(lesson.manifest())
    plan["steps"][0]["elements"] = [element({"type": "move", "dx": 0, "dy": 30})]
    first = replace(lesson, visuals=VisualPlan.from_data(plan, lesson.manifest()))
    changed = deepcopy(plan)
    changed["steps"][0]["elements"][0]["motion"]["dy"] = 31
    second = replace(lesson, visuals=VisualPlan.from_data(changed, lesson.manifest()))
    assert first.manifest()["fingerprint"] != second.manifest()["fingerprint"]
    assert first.spoken_script == second.spoken_script


def test_new_outputs_are_self_contained_off_by_default_and_do_not_start_services():
    page = whiteboard_html(parse_lesson("# تجربة\nسطر واحد."))
    assert 'id="wb-output-review" type="checkbox">' in page
    assert 'id="wb-print" class="primary" type="button" disabled' in page
    assert 'id="wb-video" class="primary" type="button" disabled' in page
    assert 'id="wb-print-root"' in page
    assert "window.novaWhiteboardOutput.init" in page
    assert "body>*:not(#wb-print-root)" in page
    assert "@@NOVA_" not in page
    for forbidden in (
        "fetch(",
        "getUserMedia(",
        "getDisplayMedia(",
        "new WebSocket(",
        "<script src=",
    ):
        assert forbidden not in page
    assert "containerExtension" in page  # Actual MIME + container header, not a renamed WebM.
    assert "webmDuration" in page  # Optional, equal-length EBML metadata finalization.


def test_authored_animation_fixture_keeps_the_brief_and_complete_narration_not_live_ai():
    original = LessonDraft.load(EXAMPLES / "complete-lesson-demo.json")
    animated = LessonDraft.load(EXAMPLES / "animated-lesson-demo.json")
    lesson = animated.compile()
    assert animated.brief == original.brief
    assert lesson.spoken_script == original.compile().spoken_script
    assert len(lesson.steps) == 10
    motions = [
        e["motion"]["type"]
        for step in animated.to_data()["draft"]["steps"]
        for e in step["elements"]
        if "motion" in e
    ]
    assert {"move", "pulse", "none"}.issubset(motions)
    assert "مثال محلي لا API" in lesson.title
    assert "مؤلف يدويًا" in animated.to_data()["draft"]["notes"][-1]
    path = EXAMPLES / "animated-lesson-demo.html"
    assert WhiteboardPage.load(path).lesson == lesson
    assert path.read_text(encoding="utf-8-sig") == whiteboard_html(lesson)
