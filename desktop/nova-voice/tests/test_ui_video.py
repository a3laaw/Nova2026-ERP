"""Native conversion integration; deliberately skipped without Qt host libraries."""

import os
from pathlib import Path

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets", exc_type=ImportError)

import test_ui as native  # noqa: E402
from PySide6.QtTest import QSignalSpy  # noqa: E402
from PySide6.QtWidgets import QFileDialog, QMessageBox  # noqa: E402

from nova_voice.video import VideoResult  # noqa: E402

qapp, window = native.qapp, native.window


def selected(window):
    picker = window.video_picker
    picker._select(Path("reviewed.webm"))
    picker._select(Path("trusted-ffmpeg"), encoder=True)
    picker.review.setChecked(True)
    return picker


def test_new_tab_does_not_generate_speech_or_discover_an_encoder_on_start(window):
    picker = window.video_picker
    assert window.workspace_tabs.tabText(4) == "MP4 متوافق"
    assert picker.current() is None and not picker.review.isChecked()
    assert not picker.convert_button.isEnabled()
    assert window.worker is None and window.player.source().isEmpty()
    assert picker._source is None and picker._ffmpeg is None


def test_selection_and_success_clear_review_and_sacred_policy_blocks_conversion(window):
    picker = selected(window)
    assert picker.convert_button.isEnabled()
    picker._select(Path("another.webm"))
    assert picker.current() is None
    picker.review.setChecked(True)
    assert picker.current() is not None
    window.scene_picker.policy.setCurrentIndex(1)
    window._update_buttons()
    assert not picker.review.isChecked() and picker.current() is None
    assert not picker.convert_button.isEnabled()
    window.scene_picker.policy.setCurrentIndex(0)
    picker.review.setChecked(True)
    picker.set_result(VideoResult(Path("done.mp4"), 3, 1280, 720, False, 100))
    assert picker.open_button.isEnabled() and not picker.review.isChecked()


def test_conversion_uses_main_worker_without_changing_editor_or_audio_result(window, monkeypatch):
    picker = selected(window)
    before = window.editor.toPlainText()
    tasks = []
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: ("new.mp4", ""))
    monkeypatch.setattr(window, "_start_task", lambda task, kind: tasks.append((task, kind)))
    picker.convert_button.click()
    assert len(tasks) == 1 and tasks[0][1] == "video-convert"
    assert window.editor.toPlainText() == before and window.player.source().isEmpty()
    window._task_success(VideoResult(Path("new.mp4"), 2, 1280, 720, True, 100))
    assert "AAC-LC" in picker.result_label.text()
    assert window.player.source().isEmpty() and window._html_result_file is None


def test_stale_or_unreviewed_signal_and_cancelled_dialog_do_not_start_work(window, monkeypatch):
    picker = selected(window)
    request = picker.current()
    tasks = []
    monkeypatch.setattr(window, "_start_task", lambda *a: tasks.append(a))
    picker.review.setChecked(False)
    window._convert_video(request)
    assert tasks == []
    picker.review.setChecked(True)
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: ("", ""))
    picker.convert_button.click()
    assert tasks == []


def test_signal_emits_a_snapshot_without_implicit_conversion(window):
    picker = selected(window)
    spy = QSignalSpy(picker.requested)
    # Avoid the main save dialog; only the panel contract is exercised here.
    picker.requested.disconnect(window._convert_video)
    picker.convert_button.click()
    assert spy.count() == 1 and window.worker is None


def test_existing_appended_mp4_name_requires_explicit_replace_consent(
    window, tmp_path, monkeypatch
):
    picker = selected(window)
    target = tmp_path / "existing.mp4"
    target.write_bytes(b"previous")
    tasks = []
    monkeypatch.setattr(
        QFileDialog, "getSaveFileName", lambda *a, **k: (str(target.with_suffix("")), "")
    )
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.No)
    monkeypatch.setattr(window, "_start_task", lambda *a: tasks.append(a))
    picker.convert_button.click()
    assert tasks == [] and target.read_bytes() == b"previous"
