"""Shared strict motion vectors; no native renderer or live-model claims."""

import json
from copy import deepcopy
from dataclasses import replace
from pathlib import Path

import pytest

from nova_voice.lesson_draft import LessonDraft
from nova_voice.scenes import SceneError, VisualPlan, empty_plan, validate_element
from nova_voice.whiteboard import WhiteboardPage, parse_lesson, save_whiteboard

FIXTURES = Path(__file__).parent / "fixtures"
CASES = json.loads((FIXTURES / "motion-cases.json").read_text(encoding="utf-8"))


def shape(motion):
    return {"kind": "circle", "row": 0, "x": 500, "y": 200, "r": 30, "motion": motion}


@pytest.mark.parametrize("motion", CASES["valid"])
def test_path_rotation_and_easing_are_bounded_data_and_round_trip(tmp_path, motion):
    lesson = parse_lesson("# Motion\nOne cue.\nAnother cue.")
    plan = empty_plan(lesson.manifest())
    plan["steps"][0]["elements"] = [shape(motion)]
    illustrated = replace(lesson, visuals=VisualPlan.from_data(plan, lesson.manifest()))
    original = illustrated.manifest()
    save_whiteboard(illustrated, tmp_path / "motion.html")
    assert WhiteboardPage.load(tmp_path / "motion.html").lesson == illustrated
    changed = deepcopy(plan)
    changed["steps"][0]["elements"][0]["motion"] = {"type": "none"}
    other = replace(lesson, visuals=VisualPlan.from_data(changed, lesson.manifest()))
    assert other.manifest()["fingerprint"] != original["fingerprint"]
    assert other.spoken_script == illustrated.spoken_script == lesson.spoken_script


@pytest.mark.parametrize("motion", CASES["invalid"])
def test_shared_invalid_path_rotation_and_easing_vectors_fail_closed(motion):
    with pytest.raises(SceneError):
        validate_element(shape(motion), 2)


def test_advanced_authored_example_preserves_original_brief_and_narration():
    root = Path(__file__).parents[1] / "examples"
    original = LessonDraft.load(root / "complete-lesson-demo.json")
    advanced = LessonDraft.load(root / "advanced-motion-demo.json")
    assert advanced.brief == original.brief
    assert advanced.compile().spoken_script == original.compile().spoken_script
    motions = [
        e.get("motion", {}).get("type")
        for s in advanced.to_data()["draft"]["steps"]
        for e in s["elements"]
    ]
    assert {"path", "rotate", "none"}.issubset(motions)
    assert "مؤلف يدويًا" in advanced.to_data()["draft"]["notes"][-1]
    assert WhiteboardPage.load(root / "advanced-motion-demo.html").lesson == advanced.compile()
