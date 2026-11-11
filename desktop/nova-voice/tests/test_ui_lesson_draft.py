"""Native full-lesson review gates; skip when Qt's host system libraries are absent."""

import json
import os
from dataclasses import asdict
from pathlib import Path

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets", exc_type=ImportError)

# Reuse the same native fixtures, not another application or test runtime dependency.
import test_ui as native  # noqa: E402
from PySide6.QtWidgets import QFileDialog, QMessageBox  # noqa: E402
from test_ui import add_bilingual_voices  # noqa: E402

from nova_voice.lesson_draft import LessonDraft  # noqa: E402
from nova_voice.scenes import VisualPlan  # noqa: E402
from nova_voice.text import ScriptError  # noqa: E402
from nova_voice.whiteboard import WhiteboardPage  # noqa: E402

qapp = native.qapp
window = native.window

EXAMPLES = Path(__file__).parents[1] / "examples"


def example():
    return LessonDraft.load(EXAMPLES / "complete-lesson-demo.json")


def adopt(window, monkeypatch, *, approve=True):
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.Yes)
    monkeypatch.setattr(QMessageBox, "warning", lambda *a, **k: None)
    draft = example()
    window.lesson_picker._fill(draft)
    window.lesson_picker._adopt()
    assert window._adopted_draft == draft
    if approve:
        window.scene_picker._approve()
        assert window._story_ready()
    return draft


def test_example_response_import_stays_draft_only_and_does_not_touch_the_editor_or_voices(window):
    window.editor.setPlainText("My old script stays here.")
    before = window._cast()
    window.lesson_picker._fill(example())
    window._task_success(example())
    assert window.editor.toPlainText() == "My old script stays here."
    assert window._cast() == before and window.worker is None
    assert window._adopted_draft is None and window.scene_picker._approved is None
    assert window.lesson_picker.current() == example()
    assert "الوصف الأصلي" in window.lesson_picker.review.toPlainText()
    assert not window.play_button.isEnabled() and window.player.source().isEmpty()
    assert "brief" not in json.loads(window.lesson_picker.draft_edit.toPlainText())


def test_response_for_a_changed_brief_is_not_accepted_or_adopted(window, monkeypatch):
    warnings = []
    monkeypatch.setattr(QMessageBox, "warning", lambda *a, **k: warnings.append(a[-1]))
    window.editor.setPlainText("Keep my script.")
    window.lesson_picker.brief_edit.setPlainText("Another short description.")
    window._task_success(example())
    assert warnings and not window.lesson_picker.draft_edit.toPlainText()
    assert window.editor.toPlainText() == "Keep my script." and window._adopted_draft is None


def test_adoption_requires_scene_review_and_does_not_start_audio_or_export(window, monkeypatch):
    draft = adopt(window, monkeypatch, approve=False)
    assert window.editor.toPlainText() == draft.compile().script
    assert window._source_lesson().manifest()["schema"] == 1
    assert not window.create_board_button.isEnabled()
    assert not window.combined_board_button.isEnabled()
    assert window.scene_picker._approved is None and window.worker is None
    assert window.player.source().isEmpty()
    window.scene_picker._approve()
    assert window.create_board_button.isEnabled()
    exported = window._lesson_for_export()
    assert exported == draft.compile()
    assert exported.visuals.to_data()["origin"]["brief"] == draft.brief.to_data()


def test_audio_only_uses_expanded_approved_narration_not_titles_brief_or_json(
    window, monkeypatch, bilingual_cast
):
    add_bilingual_voices(window, bilingual_cast)
    window.primary_voice.language_combo.setCurrentIndex(1)
    draft = adopt(window, monkeypatch)
    text, cast = window._input()
    assert text == draft.compile().spoken_script and set(cast) == {1}
    assert draft.brief.to_data()["text"] not in text
    assert "أهداف الدرس" not in text and "##" not in text and "fingerprint" not in text
    assert window.generate_button.isEnabled() and window.preview_button.isEnabled()


@pytest.mark.parametrize(
    "change",
    [
        "source",
        "narrator",
        "brief",
        "brief-subject",
        "brief-grade",
        "raw-json",
        "scene-json",
        "scene-subject",
        "scene-grade",
        "policy",
        "unchecked",
    ],
)
def test_stale_or_unchecked_full_draft_cannot_bypass_review_via_any_editor_export(
    window, monkeypatch, bilingual_cast, tmp_path, change
):
    add_bilingual_voices(window, bilingual_cast)
    window.primary_voice.language_combo.setCurrentIndex(1)
    adopt(window, monkeypatch)
    panel = window.lesson_picker
    if change == "source":
        window.editor.insertPlainText("Changed. ")
    elif change == "narrator":
        window.mode_combo.setCurrentIndex(1)
    elif change == "brief":
        panel.brief_edit.insertPlainText("Changed. ")
    elif change == "brief-subject":
        panel.subject.setText("Other")
    elif change == "brief-grade":
        panel.grade.setText("Other")
    elif change == "raw-json":
        panel.draft_edit.insertPlainText(" ")
    elif change == "scene-json":
        window.scene_picker.plan_edit.insertPlainText(" ")
    elif change == "scene-subject":
        window.scene_picker.subject.setText("Other")
    elif change == "scene-grade":
        window.scene_picker.grade.setText("Other")
    elif change == "policy":
        window.scene_picker.policy.setCurrentIndex(1)
    else:
        window.scene_picker.use_plan.setChecked(False)
    assert not window._story_ready()
    window.scene_picker.use_plan.setChecked(False)  # Legacy bypass is forbidden for adopted drafts.
    assert not window.create_board_button.isEnabled()
    assert not window.combined_board_button.isEnabled()
    assert not window.generate_button.isEnabled() and not window.preview_button.isEnabled()
    with pytest.raises(ScriptError):
        window._lesson_for_export()
    warnings = []
    monkeypatch.setattr(QMessageBox, "warning", lambda *a, **k: warnings.append(a[-1]))

    def no_dialog(*a, **k):
        pytest.fail("An invalid adopted draft must be blocked before any save dialog or worker.")

    monkeypatch.setattr(QFileDialog, "getSaveFileName", no_dialog)
    for action in (
        window.generate,
        window.preview,
        window.generate_whiteboard,
        window.generate_whiteboard_with_audio,
    ):
        action()
        assert window.worker is None
    assert len(warnings) == 4


def test_raw_edit_recomputes_hash_locally_but_needs_new_adoption_and_scene_approval(
    window, monkeypatch
):
    draft = adopt(window, monkeypatch)
    raw = json.loads(window.lesson_picker.draft_edit.toPlainText())
    raw["steps"][0]["rows"][0]["speech"] = "هذا شرح منقح للمراجعة."
    window.lesson_picker.draft_edit.setPlainText(json.dumps(raw))
    edited = window.lesson_picker.current()
    assert (
        edited.brief == draft.brief
        and edited.to_data()["fingerprint"] != draft.to_data()["fingerprint"]
    )
    assert not window._story_ready()
    window.lesson_picker._adopt()
    assert window._adopted_draft == edited and window.scene_picker._approved is None
    window.scene_picker._approve()
    assert window._lesson_for_export() == edited.compile()


def test_identical_full_bundle_reimport_does_not_inherit_adoption(window, monkeypatch):
    draft = adopt(window, monkeypatch)
    window.lesson_picker.set_draft(draft)
    assert not window._story_ready()
    window.scene_picker._approve()  # Cannot re-approve scenes instead of re-adopting changed input.
    assert not window.create_board_button.isEnabled()


def test_manual_drawing_revision_preview_export_and_approval_all_keep_original_provenance(
    window, monkeypatch, tmp_path
):
    draft = adopt(window, monkeypatch)
    raw = draft.compile().visuals.to_data()
    raw["schema"] = 1
    raw.pop("origin")
    raw["steps"][1]["description"] += " رسم منقح."
    window.scene_picker.plan_edit.setPlainText(json.dumps(raw))
    assert not window._story_ready()
    source, bound = window.scene_picker._current()
    assert bound.to_data()["origin"] == draft.compile().visuals.to_data()["origin"]
    assert source == window._source_lesson()
    monkeypatch.setattr("nova_voice.scene_picker.QDesktopServices.openUrl", lambda _: True)
    window.scene_picker._preview()
    preview = Path(window.scene_picker._preview_dir.name) / "Nova-DRAFT-review.html"
    assert WhiteboardPage.load(preview).lesson.visuals == bound
    path = tmp_path / "revised-plan.json"
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(path), ""))
    window.scene_picker._export()
    assert VisualPlan.load(path, source.manifest()) == bound
    window.scene_picker._approve()
    assert window._story_ready() and window._lesson_for_export().visuals == bound


def test_detach_is_explicit_and_restores_ordinary_editing_without_erasing_the_saved_brief(
    window, monkeypatch
):
    draft = adopt(window, monkeypatch)
    text = window.editor.toPlainText()
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.No)
    window._detach_lesson()
    assert window._adopted_draft == draft
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.Yes)
    window._detach_lesson()
    assert window._adopted_draft is None and window.editor.toPlainText() == text
    assert window.lesson_picker.current() == draft and window.scene_picker._approved is None
    window.scene_picker.use_plan.setChecked(False)
    assert window.create_board_button.isEnabled()
    assert window._lesson_for_export().visuals is None


def test_lesson_request_only_sends_exact_brief_clears_key_and_does_not_include_old_script(window):
    window.editor.setPlainText("Old private script, not part of this request.")
    panel, requests = window.lesson_picker, []
    panel._fill(example())
    panel.requested.disconnect()
    panel.requested.connect(requests.append)
    panel.key.setText("synthetic-only-NOT-A-REAL-KEY")
    panel.adult.setChecked(True)
    panel.consent.setChecked(True)
    panel._request()
    assert len(requests) == 1 and requests[0].brief == example().brief
    assert requests[0].adult and requests[0].consent
    assert not panel.key.text() and not panel.consent.isChecked()
    assert "synthetic-only" not in repr(requests[0]) and "Old private" not in repr(requests[0])
    assert "synthetic-only" not in repr(asdict(window.preferences))
    panel.consent.setChecked(True)
    panel.grade.setText("new grade")
    assert not panel.consent.isChecked()


def test_sacred_policy_blocks_all_full_draft_paths_even_when_manual_or_imported(
    window, monkeypatch
):
    panel = window.lesson_picker
    panel._fill(example())
    window.scene_picker.policy.setCurrentIndex(1)
    with pytest.raises(ScriptError):
        panel.current()
    requests, warnings = [], []
    panel.requested.disconnect()
    panel.requested.connect(requests.append)
    monkeypatch.setattr(QMessageBox, "warning", lambda *a, **k: warnings.append(a[-1]))
    panel.key.setText("synthetic-only-NOT-A-REAL-KEY")
    panel.adult.setChecked(True)
    panel.consent.setChecked(True)
    panel._request()
    panel._adopt()
    panel._copy_prompt()
    panel._preview()
    assert requests == [] and len(warnings) == 4
    assert window._adopted_draft is None and window.worker is None


def test_a_separate_unadopted_brief_does_not_block_the_ordinary_editor(window):
    window.editor.setPlainText("Ordinary manual script.")
    window.lesson_picker.brief_edit.setPlainText("A different unfinished brief.")
    assert window._adopted_draft is None and window.create_board_button.isEnabled()
    assert window._lesson_for_export().script == "Ordinary manual script."
