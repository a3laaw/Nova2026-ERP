"""Full lessons are locally validated, never keyword templates or inferred reviews."""

import json
from dataclasses import replace
from pathlib import Path

import pytest

from nova_voice.lesson_brief import LessonBrief
from nova_voice.lesson_draft import LessonDraft
from nova_voice.scenes import SceneError, VisualPlan
from nova_voice.text import ScriptError
from nova_voice.whiteboard import WhiteboardPage, parse_lesson, whiteboard_html

EXAMPLES = Path(__file__).parents[1] / "examples"


def example():
    return LessonDraft.load(EXAMPLES / "complete-lesson-demo.json")


def test_one_exact_brief_expands_to_objectives_four_drawn_stages_questions_answers_summary():
    draft = example()
    brief = draft.brief.to_data()
    assert brief["text"] == (EXAMPLES / "water-cycle-description.txt").read_text(encoding="utf-8")
    assert len(parse_lesson(brief["text"]).steps[0].rows) == 1
    lesson = draft.compile()
    assert len(lesson.steps) == 10 and sum(len(s.rows) for s in lesson.steps) == 16
    assert lesson.steps[0].title == "أهداف الدرس"
    assert lesson.steps[-1].title == "خلاصة الدرس"
    assert lesson.steps[5].title == "فكّر قبل الإجابة"
    assert lesson.steps[6].title == "راجع إجابتك"
    assert lesson.speakers == {1} and lesson.dialogue is False
    assert lesson.visuals.to_data()["schema"] == 2
    assert sum(bool(s["elements"]) for s in lesson.visuals.to_data()["steps"]) == 4
    assert brief["text"] not in lesson.spoken_script
    assert "أهداف الدرس" not in lesson.spoken_script
    assert "سقف سعر" not in lesson.spoken_script
    assert "ليست نتيجة" not in lesson.spoken_script


def test_original_description_survives_export_reimport_and_is_covered_by_both_fingerprints(
    tmp_path,
):
    draft = example()
    lesson = draft.compile()
    raw = lesson.visuals.to_data()
    assert raw["origin"]["brief"] == draft.brief.to_data()
    assert raw["origin"]["draft_fingerprint"] == draft.to_data()["fingerprint"]
    source = replace(lesson, visuals=None)
    assert raw["source_fingerprint"] == source.manifest()["fingerprint"]
    path = tmp_path / "complete.html"
    path.write_text(whiteboard_html(lesson), encoding="utf-8")
    assert WhiteboardPage.load(path).lesson == lesson
    assert (EXAMPLES / "complete-lesson-demo.html").read_text(
        encoding="utf-8-sig"
    ) == whiteboard_html(lesson)
    assert "الوصف الأصلي" in draft.review_text()
    assert source.script in draft.review_text()


@pytest.mark.parametrize("change", ["brief", "grade", "draft-text", "extra-key", "hash"])
def test_bundle_cannot_be_rebound_or_modified_silently(change):
    data = example().to_data()
    if change == "brief":
        data["brief"]["text"] += " altered"
    elif change == "grade":
        data["brief"]["grade"] += " new"
    elif change == "draft-text":
        data["draft"]["steps"][0]["rows"][0]["speech"] += " Changed."
    elif change == "extra-key":
        data["credential"] = "not permitted"
    else:
        data["fingerprint"] = "0" * 64
    with pytest.raises(ScriptError):
        LessonDraft.from_data(data)


@pytest.mark.parametrize("bad", ["", " ", "x" * 4001, "bad\ud800", "bad\x00"])
def test_brief_limits_and_exact_whitespace(bad):
    with pytest.raises(ScriptError):
        LessonBrief.create(bad)


def test_brief_retains_whitespace_and_all_mode_changes_in_its_fingerprint():
    a = LessonBrief.create("  A short description.\n", "science", "preparatory")
    assert a.to_data()["text"] == "  A short description.\n"
    assert a != LessonBrief.create("A short description.", "science", "preparatory")
    assert a != LessonBrief.create("  A short description.\n", "history", "preparatory")
    with pytest.raises(ScriptError):
        LessonBrief.create("Protected text.", policy="sacred")


@pytest.mark.parametrize(
    "change",
    [
        "schema-bool",
        "brief-fingerprint",
        "no-objectives",
        "no-summary",
        "no-questions",
        "unknown-step",
        "one-stage",
        "no-drawings",
        "executable-element",
        "wrong-cue",
        "unknown-voice",
        "silent-narration",
        "new-heading",
        "new-line",
        "oversized-row",
        "unknown-root",
        "answer-missing",
        "sacred",
        "too-many-stages",
    ],
)
def test_untrusted_expansions_fail_before_any_export(change):
    draft = example()
    data = draft.to_data()["draft"]
    row = data["steps"][0]["rows"][0]
    if change == "schema-bool":
        data["schema"] = True
    elif change == "brief-fingerprint":
        data["brief_fingerprint"] = "0" * 64
    elif change == "no-objectives":
        data["objectives"] = []
    elif change == "no-summary":
        data["summary"] = []
    elif change == "no-questions":
        data["questions"] = []
    elif change == "unknown-step":
        data["steps"][0]["html"] = "<script/>"
    elif change == "one-stage":
        data["steps"] = data["steps"][:1]
    elif change == "no-drawings":
        data["steps"][0]["elements"] = []
    elif change == "executable-element":
        data["steps"][0]["elements"] = [
            {"kind": "image", "row": 0, "x": 0, "y": 0, "href": "https://example.com"}
        ]
    elif change == "wrong-cue":
        data["steps"][0]["elements"][0]["row"] = 20
    elif change == "unknown-voice":
        row["speaker"] = 2
    elif change == "silent-narration":
        row["speech"] = "+ = !"
    elif change == "new-heading":
        row["speech"] = "## Injected step"
    elif change == "new-line":
        row["speech"] = "A new line.\nAnother row."
    elif change == "oversized-row":
        row["speech"] = "a" * 181
    elif change == "unknown-root":
        data["javascript"] = "run()"
    elif change == "answer-missing":
        del data["questions"][0]["answer"]
    elif change == "sacred":
        data["policy"] = "sacred"
    else:
        data["steps"] *= 3
    with pytest.raises(ScriptError):
        LessonDraft.from_response(data, draft.brief)


@pytest.mark.parametrize(
    "field", ["brief-text", "source", "draft-hash", "hints", "missing-origin", "sacred"]
)
def test_origin_is_strictly_bound_and_not_an_approval_certificate(field):
    lesson = example().compile()
    data = lesson.visuals.to_data()
    source = replace(lesson, visuals=None).manifest()
    if field == "brief-text":
        data["origin"]["brief"]["text"] += " altered"
    elif field == "source":
        data["origin"]["source_fingerprint"] = "0" * 64
    elif field == "draft-hash":
        data["origin"]["draft_fingerprint"] = "not a hash"
    elif field == "hints":
        data["grade"] = "different grade"
    elif field == "missing-origin":
        del data["origin"]
    else:
        data["policy"] = "sacred"
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source)


def test_manual_response_and_saved_bundle_are_both_accepted_only_for_the_exact_brief(tmp_path):
    draft = example()
    data = draft.to_data()
    assert LessonDraft.from_json(json.dumps(data["draft"]), draft.brief) == draft
    with pytest.raises(ScriptError):
        LessonDraft.from_json(json.dumps(data["draft"]))
    with pytest.raises(ScriptError):
        LessonDraft.from_data(data, LessonBrief.create("Another subject."))
    path = tmp_path / "saved.json"
    draft.save(path)
    assert LessonDraft.load(path) == draft
    assert not list(tmp_path.glob(".nova-lesson-draft-*"))
    with pytest.raises(ScriptError):
        draft.save(tmp_path / "wrong.html")


def test_cli_review_only_then_explicit_approval(tmp_path, monkeypatch, capsys):
    from nova_voice.lesson_draft import main

    source = EXAMPLES / "complete-lesson-demo.json"
    output = tmp_path / "lesson.html"
    monkeypatch.setattr("sys.argv", ["draft", str(source), str(output)])
    with pytest.raises(SystemExit) as error:
        main()
    assert error.value.code == 2 and not output.exists()
    assert "الوصف الأصلي" in capsys.readouterr().out
    monkeypatch.setattr("sys.argv", ["draft", str(source), str(output), "--approve-lesson"])
    main()
    assert WhiteboardPage.load(output).lesson == example().compile()


@pytest.mark.parametrize(
    "raw", ['{"schema":1,"schema":1}', '{"schema":NaN}', "[]", "\ud800", "{}" * 300000]
)
def test_malformed_duplicate_nonfinite_and_oversized_raw_json_fail_as_recoverable_errors(raw):
    with pytest.raises(ScriptError):
        LessonDraft.from_json(raw, example().brief)
