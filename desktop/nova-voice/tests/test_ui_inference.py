"""Native guide integration, deliberately skipped if the host cannot load Qt."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets", exc_type=ImportError)

import test_ui as native  # noqa: E402
from PySide6.QtWidgets import QApplication, QFileDialog, QMessageBox  # noqa: E402

qapp, window = native.qapp, native.window


def choose(picker, identifier):
    picker.search.clear()
    picker.category.setCurrentIndex(0)
    picker.mode.setCurrentIndex(0)
    picker.features.setCurrentIndex(picker.features.findData(identifier))


def test_guide_tab_does_not_shift_existing_tabs_or_start_work(window):
    assert [window.workspace_tabs.tabText(i) for i in range(window.workspace_tabs.count())] == [
        "النص والأصوات",
        "استدلال",
        "مكتبة المنهج",
    ]
    picker = window.inference_picker
    assert picker.source.toPlainText() == picker.output.toPlainText() == ""
    assert not picker.copy_button.isEnabled() and not picker.save_button.isEnabled()
    assert window.worker is None and window.player.source().isEmpty()


def test_build_and_copy_are_isolated_from_editor_voices_and_scene_adoption(window):
    picker = window.inference_picker
    before = (
        window.editor.toPlainText(),
        window.mode_combo.currentIndex(),
        window.scene_picker.plan_edit.toPlainText(),
    )
    picker.source.setPlainText("نص مؤلف للمراجعة.")
    picker.build_button.click()
    assert "أمانة المصدر" in picker.output.toPlainText()
    picker.copy_button.click()
    assert QApplication.clipboard().text() == picker.output.toPlainText()
    assert before == (
        window.editor.toPlainText(),
        window.mode_combo.currentIndex(),
        window.scene_picker.plan_edit.toPlainText(),
    )
    assert window.worker is None and window.player.source().isEmpty()


def test_field_and_feature_changes_invalidate_copy_without_clearing_source(window):
    picker = window.inference_picker
    picker.source.setPlainText("مصدر مؤلف.")
    picker.build_button.click()
    picker.grade.setText("الثاني الإعدادي")
    assert not picker.output.toPlainText() and not picker.copy_button.isEnabled()
    choose(picker, "motion-path")
    assert picker.source.toPlainText() == "مصدر مؤلف."
    assert picker.drawing_button.isEnabled()
    picker.drawing_button.click()
    assert "ليس JSON جاهزًا" in QApplication.clipboard().text()


def test_local_steps_ignore_source_and_notes(window):
    picker = window.inference_picker
    picker.source.setPlainText("PRIVATE-source")
    picker.notes.setPlainText("PRIVATE-notes")
    choose(picker, "role-colors")
    picker.build_button.click()
    assert "خطوات محلية فقط" in picker.output.toPlainText()
    assert "PRIVATE" not in picker.output.toPlainText()


def test_sacred_policy_resets_prior_prompt_and_forced_drawing_cannot_copy(window):
    picker = window.inference_picker
    choose(picker, "motion-path")
    picker.source.setPlainText("PRIVATE-source")
    picker.build_button.click()
    window.scene_picker.policy.setCurrentIndex(1)
    assert picker.output.toPlainText() == "" and not picker.copy_button.isEnabled()
    assert not picker.drawing_button.isEnabled()
    QApplication.clipboard().setText("untouched")
    picker._copy_drawing()
    assert QApplication.clipboard().text() == "untouched"
    picker.build_button.click()
    assert picker.output.toPlainText() == picker.catalog["shared"]["sacred"]
    assert "PRIVATE" not in picker.output.toPlainText()


def test_stale_native_copy_checks_policy_again_without_signal(window):
    picker = window.inference_picker
    picker.source.setPlainText("مصدر مؤلف.")
    picker.build_button.click()
    QApplication.clipboard().setText("unchanged")
    picker.policy_provider = lambda: "sacred"
    picker._copy()
    assert QApplication.clipboard().text() == "unchanged"
    assert "أعد البناء" in picker.state.text()


def test_example_decline_and_cancelled_save_do_not_replace_or_write(window, monkeypatch, tmp_path):
    picker = window.inference_picker
    picker.source.setPlainText("مصدري.")
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.No)
    picker.example_button.click()
    assert picker.source.toPlainText() == "مصدري."
    picker.build_button.click()
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: ("", ""))
    picker.save_button.click()
    assert not list(tmp_path.glob("*.txt"))


def test_explicit_save_and_added_suffix_overwrite_require_consent(window, monkeypatch, tmp_path):
    picker = window.inference_picker
    picker.source.setPlainText("مصدر مؤلف.")
    picker.build_button.click()
    path = tmp_path / "request.txt"
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(path), ""))
    picker.save_button.click()
    assert path.read_text(encoding="utf-8") == picker.output.toPlainText()
    path.write_text("previous", encoding="utf-8")
    monkeypatch.setattr(
        QFileDialog, "getSaveFileName", lambda *a, **k: (str(path.with_suffix("")), "")
    )
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.No)
    picker.save_button.click()
    assert path.read_text(encoding="utf-8") == "previous"
    assert not list(tmp_path.glob(".nova-guide-*"))


def test_oversized_source_is_not_truncated_and_search_empty_state_recovers(window):
    picker = window.inference_picker
    picker.source.setPlainText("ن" * 12001)
    picker.build_button.click()
    assert len(picker.source.toPlainText()) == 12001 and not picker.output.toPlainText()
    assert "12000" in picker.state.text()
    picker.search.setText("not-an-entry-xz")
    assert picker.features.count() == 0 and not picker.build_button.isEnabled()
    choose(picker, "whiteboard")
    assert picker.features.currentData() == "whiteboard"
    assert len(picker.source.toPlainText()) == 12001
