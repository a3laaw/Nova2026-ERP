"""Bounded validated drawing history, never stored credentials or approval."""

import base64
from dataclasses import FrozenInstanceError, replace
from html.parser import HTMLParser
from pathlib import Path

import pytest
from test_scene_scope import assets_in, lesson, previous
from test_secondary_assets import raw

from nova_voice import scene_history as history_module
from nova_voice.lesson_draft import LessonDraft
from nova_voice.scene_history import PlanHistory, changed_steps, comparison_html
from nova_voice.scenes import SceneError, VisualPlan, empty_plan
from nova_voice.secondary_assets import normalize_svg
from nova_voice.whiteboard import WhiteboardPage, parse_lesson


def changed(plan=None, delta=20):
    data = (plan or previous()).to_data()
    data["steps"][1]["elements"][0]["x"] += delta
    return VisualPlan.from_data(data, lesson().manifest())


class Frames(HTMLParser):
    def __init__(self):
        super().__init__()
        self.frames, self.policies = [], []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "iframe":
            self.frames.append(attrs)
        if tag == "meta" and attrs.get("http-equiv") == "Content-Security-Policy":
            self.policies.append(attrs["content"])


def test_history_records_owned_labels_and_immutable_canonical_snapshots_not_approval(
    tmp_path, monkeypatch
):
    monkeypatch.chdir(tmp_path)
    history = PlanHistory()
    plan, source = previous(), lesson().manifest()
    entry = history.record(plan, source, "نسخة الرسم")
    mutable_copy = plan.to_data()
    mutable_copy["steps"][1]["elements"].clear()
    assert entry.plan == plan and history.current == entry
    assert isinstance(history.entries, tuple) and not list(tmp_path.iterdir())
    assert not history.can_undo and not history.can_redo
    assert "SELECTED_PUBLIC_SENTINEL" not in repr(entry) + repr(history)
    assert "payload_json" not in repr(entry)
    with pytest.raises(FrozenInstanceError):
        entry.label = "changed"
    assert not hasattr(entry, "approved") and not hasattr(entry, "key")


def test_consecutive_checkpoints_are_deduplicated_and_restore_never_re_records_old_version():
    history, source = PlanHistory(), lesson().manifest()
    first = history.record(previous(), source)
    assert history.record(previous(), source) == first and len(history.entries) == 1
    second = history.record(changed(), source)
    assert history.can_undo and not history.can_redo
    assert history.previous_number() == first.number
    restored = history.restore(first.number, source, changed())
    assert restored == previous() and not history.can_undo and history.can_redo
    assert history.record(restored, source) == first and len(history.entries) == 2
    assert history.previous_number(forward=True) == second.number
    assert history.restore(second.number, source, restored) == changed()
    assert len(history.entries) == 2 and history.current == second


def test_returning_to_old_version_keeps_newer_proposals_available_instead_of_deleting_them():
    history, source = PlanHistory(), lesson().manifest()
    first = history.record(previous(), source)
    second = history.record(changed(), source)
    history.restore(first.number, source, changed())
    third = history.record(changed(delta=25), source, "فرع مراجعة جديد")
    assert [e.number for e in history.entries] == [first.number, second.number, third.number]
    assert history.find(second.number, source, third.plan).plan == changed()


def test_entry_limit_prunes_oldest_and_never_reuses_evicted_or_cleared_ids():
    history, source = PlanHistory(), lesson().manifest()
    numbers = [history.record(changed(delta=i), source).number for i in range(20)]
    assert len(history.entries) == 12
    assert history.entries[0].number == numbers[-12]
    with pytest.raises(SceneError, match="تعد"):
        history.restore(numbers[0], source, changed())
    last = history.current.number
    history.clear()
    assert history.entries == () and history.current is None
    assert not history.can_undo and not history.can_redo
    entry = history.record(previous(), source)
    assert entry.number > last
    with pytest.raises(SceneError):
        history.find(last, source, previous())


def test_byte_limit_is_independent_of_entry_limit_and_preserves_a_valid_current_snapshot(
    monkeypatch,
):
    history, source = PlanHistory(), lesson().manifest()
    size = len(previous().payload_json.encode())
    monkeypatch.setattr(history_module, "MAX_HISTORY_BYTES", size * 2 + 5)
    for i in range(8):
        history.record(changed(delta=i), source)
    assert 1 <= len(history.entries) <= 2
    assert sum(len(e.plan.payload_json.encode()) for e in history.entries) <= size * 2 + 5
    assert history.current.plan == changed(delta=7)


@pytest.mark.parametrize("label", ["", "x" * 81, None, 1, "bad\nlabel", "bad\ud800"])
def test_untrusted_or_oversized_history_labels_cannot_be_recorded(label):
    history = PlanHistory()
    with pytest.raises(SceneError):
        history.record(previous(), lesson().manifest(), label)
    assert history.entries == ()


@pytest.mark.parametrize("number", [None, True, False, 1.0, "1", -1, 200])
def test_restore_rejects_unknown_or_non_integer_numbers(number):
    history = PlanHistory()
    history.record(previous(), lesson().manifest())
    with pytest.raises(SceneError):
        history.restore(number, lesson().manifest(), previous())


@pytest.mark.parametrize("forward", [False, True])
def test_history_direction_without_available_neighbor_is_an_explicit_error(forward):
    history = PlanHistory()
    with pytest.raises(SceneError):
        history.previous_number(forward=forward)
    history.record(previous(), lesson().manifest())
    with pytest.raises(SceneError):
        history.previous_number(forward=forward)


@pytest.mark.parametrize("mutation", ["subject", "grade", "rows"])
def test_other_text_or_planning_context_cannot_restore_or_compare_and_new_record_clears_old_context(
    mutation,
):
    history, source = PlanHistory(), lesson().manifest()
    old = history.record(previous(), source)
    data = previous().to_data()
    if mutation == "rows":
        data["steps"][1]["rows"][0]["speech"] = "Different reviewed narration."
    else:
        data[mutation] = "Different context"
    current = VisualPlan.from_data(data, source)
    with pytest.raises(SceneError):
        history.find(old.number, source, current)
    with pytest.raises(SceneError):
        comparison_html(lesson(), old.plan, current)
    new = history.record(current, source)
    assert history.entries == (new,) and new.number > old.number


def test_changed_script_and_voice_mode_cannot_restore_old_versions():
    history = PlanHistory()
    entry = history.record(previous(), lesson().manifest())
    for new_lesson in (
        parse_lesson("# Other\nAnother source."),
        replace(lesson(), dialogue=False),
    ):
        source = new_lesson.manifest()
        current = VisualPlan.from_data(empty_plan(source), source)
        with pytest.raises(SceneError):
            history.find(entry.number, source, current)
    new = history.record(current, source)
    assert history.entries == (new,)


def test_general_history_cannot_be_restored_into_protected_policy_and_policy_record_starts_over():
    source, history = lesson().manifest(), PlanHistory()
    first = history.record(previous(), source)
    data = empty_plan(source)
    data["policy"] = "sacred"
    protected = VisualPlan.from_data(data, source)
    with pytest.raises(SceneError):
        history.restore(first.number, source, protected)
    final = history.record(protected, source)
    assert history.entries == (final,)


def test_expanded_origin_is_part_of_history_context_not_just_the_same_script_hash():
    draft = LessonDraft.load(
        Path(__file__).resolve().parents[1] / "examples/complete-lesson-demo.json"
    )
    compiled = draft.compile()
    source = replace(compiled, visuals=None).manifest()
    history = PlanHistory()
    entry = history.record(compiled.visuals, source)
    data = compiled.visuals.to_data()
    data.pop("origin")
    data["schema"] = 1
    unbound = VisualPlan.from_data(data, source)
    with pytest.raises(SceneError):
        history.find(entry.number, source, unbound)
    with pytest.raises(SceneError):
        comparison_html(compiled, compiled.visuals, unbound)
    new = history.record(unbound, source)
    assert history.entries == (new,)


def test_invalid_plan_is_not_checkpointed_and_does_not_destroy_an_existing_valid_history():
    history = PlanHistory()
    entry = history.record(previous(), lesson().manifest())
    with pytest.raises(SceneError):
        history.record(VisualPlan("{}"), lesson().manifest())
    assert history.entries == (entry,)


def test_changed_steps_also_detects_a_shared_resource_change_not_just_step_json():
    before = assets_in(target="gi-water-drop", outside="gi-water-drop")
    data = before.to_data()
    data["resources"] = [normalize_svg(raw("gi-water-drop"), "gi-water-drop")]
    after = VisualPlan.from_data(data, lesson().manifest())
    assert changed_steps(before, after) == (0, 1)
    assert changed_steps(previous(), changed()) == (1,)
    assert changed_steps(previous(), previous()) == ()


def test_comparison_contains_actual_independent_safe_whiteboards_and_the_untouched_source(tmp_path):
    page = comparison_html(lesson(), previous(), changed())
    parser = Frames()
    parser.feed(page)
    assert len(parser.frames) == 2 and len(parser.policies) == 1
    assert "connect-src 'none'" in parser.policies[0] and "media-src 'none'" in parser.policies[0]
    for index, frame in enumerate(parser.frames):
        assert frame["sandbox"] == "allow-scripts"
        assert frame["src"].startswith("data:text/html;base64,")
        content = base64.b64decode(frame["src"].split(",", 1)[1]).decode()
        assert 'id="nova-whiteboard-recordings"' not in content
        assert 'document.querySelectorAll("#lesson-outline button")[1]' in content
        path = tmp_path / f"{index}.html"
        path.write_text(content)
        saved = WhiteboardPage.load(path)
        assert saved.lesson.script == lesson().script and saved.lesson.dialogue
        assert saved.lesson.visuals == (previous(), changed())[index]
        assert saved.timing is None
    assert "المشاهد المختلفة: 2" in page and "المصدر والأصوات لم يتغيرا" in page
    assert "استعادة" in page and "لا اعتماد" in page


@pytest.mark.parametrize("bad", [-1, 3, True, False, 1.2, "1"])
def test_comparison_focus_requires_an_actual_scene_number(bad):
    with pytest.raises(SceneError):
        comparison_html(lesson(), previous(), changed(), focus_step=bad)


def test_explicit_focus_can_show_an_untouched_scene_and_identical_versions_are_not_fabricated():
    page = comparison_html(lesson(), previous(), changed(), focus_step=2)
    parser = Frames()
    parser.feed(page)
    assert all("[2]" in base64.b64decode(f["src"].split(",", 1)[1]).decode() for f in parser.frames)
    assert "لا تغيير في المشاهد" in comparison_html(lesson(), previous(), previous())


def test_comparison_byte_limit_fails_cleanly_without_creating_files(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(history_module, "MAX_COMPARE_BYTES", 10)
    with pytest.raises(SceneError, match="كبيرة"):
        comparison_html(lesson(), previous(), changed())
    assert not list(tmp_path.iterdir())


def test_html_attack_in_source_or_visual_description_is_literal_in_both_frames_and_parent():
    attack = '<img src=https://invalid.example/track onerror="window.PWNED=1">'
    source_lesson = parse_lesson(f"# {attack[:110]}\nSource text {attack}")
    data = empty_plan(source_lesson.manifest())
    data["steps"][0]["description"] = attack
    plan = VisualPlan.from_data(data, source_lesson.manifest())
    page = comparison_html(source_lesson, plan, plan)
    assert "<img " not in page and "&lt;img " in page
    parser = Frames()
    parser.feed(page)
    for frame in parser.frames:
        child = base64.b64decode(frame["src"].split(",", 1)[1]).decode()
        assert "<img " not in child and "\\u003cimg " in child


def test_comparison_labels_show_real_history_numbers_without_changing_any_plan_data():
    page = comparison_html(lesson(), previous(), changed(), before_number=5, after_number=9)
    assert "النسخة المختارة من السجل · نسخة 5" in page
    assert "المقترح الحالي · نسخة 9" in page


@pytest.mark.parametrize("number", [True, 0, -1, 2.0, "2"])
def test_comparison_version_label_rejects_non_positive_or_non_integer_numbers(number):
    with pytest.raises(SceneError):
        comparison_html(lesson(), previous(), changed(), before_number=number)
