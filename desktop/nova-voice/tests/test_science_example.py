"""Local science renderer evidence, NOT a live description-to-AI integration test."""

from dataclasses import replace
from pathlib import Path

import pytest

from nova_voice.scenes import SceneError, VisualPlan, review_text
from nova_voice.whiteboard import WhiteboardPage, parse_lesson, whiteboard_html

EXAMPLES = Path(__file__).parents[1] / "examples"


def fixture():
    lesson = parse_lesson((EXAMPLES / "water-cycle-script.txt").read_text(encoding="utf-8"))
    plan = VisualPlan.load(EXAMPLES / "water-cycle-plan.json", lesson.manifest())
    return lesson, plan


def test_science_case_is_an_authored_fixture_not_an_automatic_ai_result():
    lesson, plan = fixture()
    assert "ليس ناتج خدمة AI" in lesson.title
    assert "ليست استجابة من خدمة AI" in plan.to_data()["notes"][0]
    assert "لم يحوله تلقائيًا" in plan.to_data()["notes"][1]
    assert len(lesson.steps) == 1 and len(lesson.steps[0].rows) == 4
    assert lesson.speakers == {1}
    assert plan.to_data()["steps"][0]["rows"] == []


def test_the_short_description_is_not_silently_expanded_into_a_four_row_lesson():
    description = (EXAMPLES / "water-cycle-description.txt").read_text(encoding="utf-8")
    brief = parse_lesson(description)
    assert len(brief.steps) == 1 and len(brief.steps[0].rows) == 1
    _, plan = fixture()
    with pytest.raises(SceneError, match="سكريبتًا"):
        VisualPlan.from_data(plan.to_data(), brief.manifest())
    # Merely rebinding a fingerprint cannot invent the three missing row cues.
    rebound = plan.to_data() | {"source_fingerprint": brief.manifest()["fingerprint"]}
    with pytest.raises(SceneError):
        VisualPlan.from_data(rebound, brief.manifest())


def test_science_drawing_uses_four_original_row_cues_and_no_external_images():
    lesson, plan = fixture()
    data = plan.to_data()
    assert data["source_fingerprint"] == lesson.manifest()["fingerprint"]
    elements = data["steps"][0]["elements"]
    assert len(elements) == 17
    assert {element["row"] for element in elements} == {0, 1, 2, 3}
    assert all(element["kind"] != "image" and "href" not in element for element in elements)
    assert any(element.get("text") == "التبخر" and element["row"] == 0 for element in elements)
    assert any(element.get("text") == "التكاثف" and element["row"] == 1 for element in elements)
    assert any(element.get("icon") == "drop" and element["row"] == 2 for element in elements)
    assert any(
        element.get("text") == "الجريان والتجمع" and element["row"] == 3 for element in elements
    )
    assert "بخار الماء غاز غير مرئي" in data["notes"][3]


def test_science_export_is_reproducible_local_and_preserves_the_authored_script():
    lesson, plan = fixture()
    visual = replace(lesson, visuals=plan)
    html = (EXAMPLES / "water-cycle-whiteboard.html").read_text(encoding="utf-8-sig")
    assert html == whiteboard_html(visual)
    saved = WhiteboardPage.load(EXAMPLES / "water-cycle-whiteboard.html")
    assert saved.lesson == visual
    assert saved.lesson.script == lesson.script
    assert saved.lesson.manifest()["schema"] == 2
    assert saved.lesson.spoken_script == lesson.spoken_script
    assert 'id="nova-whiteboard-recordings"' not in html
    assert "المعاينة صامتة" in review_text(plan, lesson.manifest())
