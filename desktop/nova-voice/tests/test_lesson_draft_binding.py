"""Revisions can change drawings, but never silently drop a full lesson's original brief."""

import json
from dataclasses import replace
from pathlib import Path
from threading import Event

import pytest

from nova_voice.engine import RenderOptions, SpeechEngine
from nova_voice.lesson_brief import LessonBrief
from nova_voice.lesson_draft import LessonDraft
from nova_voice.scenes import VisualPlan, empty_plan
from nova_voice.text import ScriptError
from nova_voice.whiteboard import WhiteboardPage, parse_lesson, render_whiteboard_with_audio

EXAMPLES = Path(__file__).parents[1] / "examples"


def example():
    return LessonDraft.load(EXAMPLES / "complete-lesson-demo.json")


def replan():
    draft = example()
    compiled = draft.compile()
    source = replace(compiled, visuals=None)
    raw = compiled.visuals.to_data()
    raw.pop("origin")
    raw["schema"] = 1
    raw["steps"][1]["description"] += " رسم منقح محليًا."
    raw["steps"][1]["elements"][0]["fill"] = "#FFB000"
    return draft, source, VisualPlan.from_data(raw, source.manifest())


def test_revised_drawings_are_bound_to_exact_original_brief_script_and_draft():
    draft, source, plan = replan()
    bound = draft.bind_plan(plan, source)
    assert bound.to_data()["schema"] == 2
    assert bound.to_data()["origin"] == draft.compile().visuals.to_data()["origin"]
    assert bound.to_data()["steps"] == plan.to_data()["steps"]
    assert source.manifest()["schema"] == 1 and plan.to_data()["schema"] == 1
    assert draft.bind_plan(bound, source) == bound


@pytest.mark.parametrize("change", ["script", "title", "row", "dialogue", "different-source"])
def test_changed_script_or_narrator_cannot_inherit_draft_approval(change):
    draft, source, plan = replan()
    if change == "script":
        source = replace(source, script=source.script + "\n")
    elif change == "title":
        source = replace(source, title="Altered title")
    elif change == "row":
        source = replace(source, steps=(replace(source.steps[0], rows=()), *source.steps[1:]))
    elif change == "dialogue":
        source = replace(source, dialogue=True)
    else:
        source = parse_lesson("# A different lesson\nHello.")
    with pytest.raises(ScriptError):
        draft.bind_plan(plan, source)


@pytest.mark.parametrize("change", ["subject", "grade", "no-stage-drawing", "too-many-elements"])
def test_redraw_cannot_silently_change_hints_or_turn_the_full_lesson_into_text_only(change):
    draft, source, plan = replan()
    raw = plan.to_data()
    if change in ("subject", "grade"):
        raw[change] = "Altered"
    elif change == "no-stage-drawing":
        raw["steps"][1]["elements"] = []
    else:
        for step in raw["steps"]:
            step["elements"] = [
                {"kind": "circle", "row": 0, "x": 200, "y": 100, "r": 20} for _ in range(20)
            ]
    valid_plan = VisualPlan.from_data(raw, source.manifest())
    with pytest.raises(ScriptError):
        draft.bind_plan(valid_plan, source)


def test_existing_saved_provenance_cannot_be_replaced_even_if_the_generated_script_is_equal():
    draft, source, _ = replan()
    another = LessonBrief.create(
        "A different description",
        **{key: draft.brief.to_data()[key] for key in ("subject", "grade")},
    )
    raw = draft.to_data()["draft"]
    raw["brief_fingerprint"] = another.fingerprint
    other_lesson = LessonDraft.from_response(raw, another).compile()
    assert replace(other_lesson, visuals=None) == source
    with pytest.raises(ScriptError):
        draft.bind_plan(other_lesson.visuals, source)


def test_protected_text_only_plan_cannot_be_recast_as_a_general_expanded_lesson():
    draft, source, _ = replan()
    hints = draft.brief.to_data()
    raw = empty_plan(source.manifest(), subject=hints["subject"], grade=hints["grade"])
    raw["policy"] = "sacred"
    plan = VisualPlan.from_data(raw, source.manifest())
    with pytest.raises(ScriptError):
        draft.bind_plan(plan, source)


def test_raw_response_can_be_deliberately_edited_and_recompiled_but_saved_hashes_remain_required():
    draft = example()
    raw = json.loads(draft.response_json())
    assert "brief" not in raw and "fingerprint" not in raw
    assert LessonDraft.from_json(draft.response_json(), draft.brief) == draft
    raw["steps"][0]["rows"][0]["speech"] = "هذا شرح منقح يحتاج مراجعة جديدة."
    revised = LessonDraft.from_json(json.dumps(raw), draft.brief)
    assert revised.brief == draft.brief and revised != draft
    assert revised.to_data()["fingerprint"] != draft.to_data()["fingerprint"]
    assert revised.compile().manifest()["fingerprint"] != draft.compile().manifest()["fingerprint"]
    bundle = revised.to_data()
    del bundle["fingerprint"]
    with pytest.raises(ScriptError):
        LessonDraft.from_data(bundle)


def test_atomic_draft_save_failure_preserves_old_bundle_and_cleans_temp(tmp_path, monkeypatch):
    path = tmp_path / "draft.json"
    path.write_text("old data", encoding="utf-8")

    def failed(*_):
        raise OSError("simulated local failure")

    monkeypatch.setattr(Path, "replace", failed)
    with pytest.raises(OSError):
        example().save(path)
    assert path.read_text(encoding="utf-8") == "old data"
    assert not list(tmp_path.glob(".nova-lesson-draft-*"))


def test_full_lesson_measured_audio_uses_only_expanded_narration_and_keeps_the_origin(
    tmp_path, bilingual_cast, monkeypatch
):
    # Tiny synthetic ONNX produces silence. This proves rows/timing/export, NOT voice quality.
    draft = example()
    lesson = draft.compile()
    engine = SpeechEngine()
    captured = []
    original = engine.render_lines

    def render(lines, *args, **kwargs):
        captured.extend(lines)
        return original(lines, *args, **kwargs)

    monkeypatch.setattr(engine, "render_lines", render)
    path = tmp_path / "full-with-audio.html"
    result = render_whiteboard_with_audio(
        engine,
        lesson,
        {1: bilingual_cast[1]},
        path,
        RenderOptions(),
        Event(),
        lambda _: None,
        audio_format="wav",
    )
    saved = WhiteboardPage.load(path, allow_recordings=True)
    assert saved.lesson == lesson and result.path == path
    assert result.characters == lesson.characters
    assert saved.timing.lesson_fingerprint == lesson.manifest()["fingerprint"]
    assert len(saved.timing.steps) == 10
    assert sum(len(step.lines) for step in saved.timing.steps) == 16
    assert len(captured) == 16
    assert [line.text for line in captured] == lesson.spoken_script.splitlines()
    assert draft.brief.to_data()["text"] not in "\n".join(line.text for line in captured)
    assert all("##" not in line.text for line in captured)
    assert saved.lesson.visuals.to_data()["origin"] == lesson.visuals.to_data()["origin"]
    html = path.read_text(encoding="utf-8-sig")
    assert html.count('type="application/x-nova-audio"') == 10
    assert 'id="nova-whiteboard-timings"' in html
    # Re-import the canonical silent snapshot separately; audio pages are deliberately not
    # accepted as new silent-input sources by WhiteboardPage.load.
    from nova_voice.whiteboard import save_whiteboard

    silent = tmp_path / "silent.html"
    save_whiteboard(saved.lesson, silent)
    assert WhiteboardPage.load(silent).lesson == lesson
