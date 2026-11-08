"""Run natively on Windows CI; headless Linux needs Qt's system GL/EGL libraries."""

import os
import shutil

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets", exc_type=ImportError)

from PySide6.QtCore import Qt  # noqa: E402
from PySide6.QtTest import QSignalSpy  # noqa: E402
from PySide6.QtWidgets import QApplication, QMessageBox  # noqa: E402

from nova_voice.ui import MainWindow  # noqa: E402
from nova_voice.voices import Cancelled  # noqa: E402


@pytest.fixture(scope="session")
def qapp():
    app = QApplication.instance() or QApplication([])
    app.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
    app.setQuitOnLastWindowClosed(False)
    return app


@pytest.fixture
def window(qapp, tmp_path, monkeypatch):
    monkeypatch.setattr("nova_voice.ui.application_dir", lambda: tmp_path / "app")
    widget = MainWindow(tmp_path / "data")
    yield widget
    if widget.worker:
        widget.worker.cancel_event.set()
        QSignalSpy(widget.worker.finished).wait(30000)
    widget.close()
    qapp.processEvents()


def add_test_voice(window, voice_files):
    root = window.library.user_root
    root.mkdir(parents=True)
    for path in voice_files:
        shutil.copyfile(path, root / path.name)
    window.refresh_voices()


def test_empty_state_and_script_enablement(window, voice_files):
    assert not window.generate_button.isEnabled()
    assert window.setup_hint.isHidden() is False
    window.editor.setPlainText("مرحبًا بالعالم.")
    assert not window.preview_button.isEnabled()
    add_test_voice(window, voice_files)
    assert window.generate_button.isEnabled()
    assert window.preview_button.isEnabled()
    assert window.setup_hint.isHidden()
    window.editor.clear()
    assert not window.generate_button.isEnabled()


def test_background_preview_completes_and_unlocks_ui(window, voice_files):
    add_test_voice(window, voice_files)
    window.editor.setPlainText("Hello world.")
    window.preview()
    worker = window.worker
    assert worker is not None
    assert not window.editor.isEnabled()
    assert QSignalSpy(worker.finished).wait(30000)
    QApplication.processEvents()
    assert window.worker is None
    assert window.editor.isEnabled()
    assert list(__import__("pathlib").Path(window._preview_directory.name).glob("*.wav"))
    assert "معاينة مؤقتة" in window.result_path.text()


def test_close_cancels_without_destroying_running_thread(window, monkeypatch):
    def wait_for_cancel(cancel, progress):
        cancel.wait(30)
        raise Cancelled()

    window._start_task(wait_for_cancel, "render")
    worker = window.worker
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.Yes)
    assert not window.close()
    assert window._closing
    assert QSignalSpy(worker.finished).wait(30000)
    QApplication.processEvents()
    assert window.worker is None
    assert window._cleanup_done


def add_bilingual_voices(window, bilingual_cast):
    root = window.library.user_root
    root.mkdir(parents=True, exist_ok=True)
    for assignment in bilingual_cast.values():
        for path in (assignment.voice.model_path, assignment.voice.config_path):
            shutil.copyfile(path, root / path.name)
    window.refresh_voices()


def test_language_filters_are_independent_for_both_roles(window, bilingual_cast):
    add_bilingual_voices(window, bilingual_cast)
    window.primary_voice.language_combo.setCurrentIndex(1)  # Arabic
    window.secondary_voice.language_combo.setCurrentIndex(2)  # English
    assert window.primary_voice.selected_voice().language_family == "ar"
    assert window.secondary_voice.selected_voice().language_family == "en"
    window.mode_combo.setCurrentIndex(1)
    window.editor.setPlainText("[1] مرحبًا.\n[2] Hello.")
    assert window.generate_button.isEnabled()
    assert set(window._input()[1]) == {1, 2}
    assert window.voice_tabs.isTabVisible(1)
    window.mode_combo.setCurrentIndex(0)
    assert not window.voice_tabs.isTabVisible(1)
    assert window.editor.toPlainText() == "[1] مرحبًا.\n[2] Hello."


def test_missing_language_does_not_fall_back_to_wrong_voice(window, voice_files):
    add_test_voice(window, voice_files)  # only the synthetic English voice
    window.primary_voice.language_combo.setCurrentIndex(1)  # Arabic
    window.editor.setPlainText("نص عربي.")
    assert window.primary_voice.selected_voice() is None
    assert not window.generate_button.isEnabled()
    window.primary_voice.language_combo.setCurrentIndex(2)
    assert window.primary_voice.selected_voice().language_family == "en"


def test_reassigning_existing_paragraph_keeps_its_text(window):
    window.editor.setPlainText("Hello world.")
    window._tag_paragraph(1)
    assert window.dialogue_mode()
    assert window.editor.toPlainText() == "[1] Hello world."
    window._tag_paragraph(2)
    assert window.editor.toPlainText() == "[2] Hello world."
    window.editor.undo()
    assert window.editor.toPlainText() == "[1] Hello world."


def test_identical_cast_and_single_mode_tags_show_validation_errors(
    window, voice_files, monkeypatch
):
    add_test_voice(window, voice_files)
    messages = []
    monkeypatch.setattr(QMessageBox, "warning", lambda *args: messages.append(args[-1]))
    window.editor.setPlainText("[1] Hello.\n[2] Reply.")
    assert window._input() is None  # single mode must not speak the labels
    window.mode_combo.setCurrentIndex(1)
    assert window._input() is None  # same English voice for both people
    assert len(messages) == 2


def test_bilingual_preview_renders_both_voices_in_one_file(window, bilingual_cast):
    import wave
    from pathlib import Path

    add_bilingual_voices(window, bilingual_cast)
    window.primary_voice.language_combo.setCurrentIndex(1)
    window.secondary_voice.language_combo.setCurrentIndex(2)
    window.mode_combo.setCurrentIndex(1)
    window.turn_pause_spin.setValue(400)
    window.editor.setPlainText("[1] مرحبًا.\n[2] Hello.")
    window.preview()
    worker = window.worker
    assert worker is not None
    assert QSignalSpy(worker.finished).wait(30000)
    QApplication.processEvents()
    assert window.worker is None
    paths = list(Path(window._preview_directory.name).glob("*.wav"))
    assert len(paths) == 1
    with wave.open(str(paths[0]), "rb") as audio:
        assert audio.getnframes() / audio.getframerate() == pytest.approx(2.4, abs=0.001)


def test_dialogue_preferences_save_separate_voice_choices(window, bilingual_cast):
    from nova_voice.storage import load_preferences

    add_bilingual_voices(window, bilingual_cast)
    window.primary_voice.language_combo.setCurrentIndex(1)
    window.secondary_voice.language_combo.setCurrentIndex(2)
    window.mode_combo.setCurrentIndex(1)
    window.turn_pause_spin.setValue(650)
    window.cleanup()
    saved = load_preferences(window.data_dir)
    assert saved.mode == "dialogue"
    assert (saved.language, saved.second_language) == ("ar", "en")
    assert saved.voice_path != saved.second_voice_path
    assert saved.turn_pause_ms == 650


def test_html_source_selection_enables_export_without_touching_the_page(
    window, voice_files, tmp_path, monkeypatch
):
    from PySide6.QtWidgets import QFileDialog

    add_test_voice(window, voice_files)
    window.editor.setPlainText("Hello.")
    assert not window.html_export_button.isEnabled()
    source = tmp_path / "page.html"
    source.write_text("<body>Original page</body>")
    monkeypatch.setattr(QFileDialog, "getOpenFileName", lambda *a, **k: (str(source), ""))
    window._choose_html()
    assert window.html_export_button.isEnabled()
    assert source.read_text() == "<body>Original page</body>"
    window._clear_html()
    assert not window.html_export_button.isEnabled()
    assert source.exists()


def test_generate_html_finishes_with_open_page_action_not_a_media_player_source(
    window,
    voice_files,
    tmp_path,
    monkeypatch,
):
    from PySide6.QtWidgets import QFileDialog

    add_test_voice(window, voice_files)
    window.editor.setPlainText("Hello.")
    window.format_combo.setCurrentIndex(1)  # WAV for the tiny integration test.
    source = tmp_path / "original.html"
    source.write_text("<body>Original page</body>")
    output = tmp_path / "with-voice.html"
    window._html_source = source
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(output), ""))
    window.generate_html()
    worker = window.worker
    assert worker is not None
    assert QSignalSpy(worker.finished).wait(30000)
    QApplication.processEvents()
    assert window.worker is None
    assert window.open_html_button.isEnabled()
    assert window.player.source().isEmpty()
    assert "data:audio/wav;base64," in output.read_text(encoding="utf-8-sig")
    assert source.read_text() == "<body>Original page</body>"


def test_html_original_overwrite_is_blocked_before_starting_a_worker(
    window, voice_files, tmp_path, monkeypatch
):
    from PySide6.QtWidgets import QFileDialog

    add_test_voice(window, voice_files)
    window.editor.setPlainText("Hello.")
    source = tmp_path / "original.html"
    source.write_text("<body>Original page</body>")
    window._html_source = source
    messages = []
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(source), ""))
    monkeypatch.setattr(QMessageBox, "warning", lambda *a, **k: messages.append(a[-1]))
    window.generate_html()
    assert window.worker is None
    assert len(messages) == 1
    assert source.read_text() == "<body>Original page</body>"


def test_whiteboard_step_one_does_not_need_any_voice(window, tmp_path, monkeypatch):
    from PySide6.QtWidgets import QFileDialog

    from nova_voice.whiteboard import WhiteboardPage

    window.editor.setPlainText("# Lesson\n## First\nHello.")
    assert window.create_board_button.isEnabled()
    assert not window.board_audio_button.isEnabled()
    output = tmp_path / "board.html"
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(output), ""))
    window.generate_whiteboard()
    worker = window.worker
    assert worker is not None
    assert QSignalSpy(worker.finished).wait(30000)
    QApplication.processEvents()
    assert window.worker is None
    assert window.open_board_button.isEnabled()
    assert not window.board_audio_button.isEnabled()
    assert window.player.source().isEmpty()
    assert WhiteboardPage.load(output).lesson.title == "Lesson"


def test_whiteboard_audio_comes_from_saved_html_not_editor(
    window, voice_files, tmp_path, monkeypatch
):
    from PySide6.QtWidgets import QFileDialog

    from nova_voice.whiteboard import WhiteboardPage, parse_lesson, save_whiteboard

    add_test_voice(window, voice_files)
    source = tmp_path / "board.html"
    lesson = parse_lesson("# Saved title\n## Saved step\nSaved sentence.")
    save_whiteboard(lesson, source)
    board = WhiteboardPage.load(source)
    window._board_source = source
    window._board_lesson = board.lesson
    window.editor.setPlainText("Different sentence in editor.")
    window.format_combo.setCurrentIndex(1)
    output = tmp_path / "with-audio.html"
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(output), ""))
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.Yes)
    calls = []
    original = window.engine.render

    def render(text, *args, **kwargs):
        calls.append(text)
        return original(text, *args, **kwargs)

    monkeypatch.setattr(window.engine, "render", render)
    window.generate_whiteboard_audio()
    worker = window.worker
    assert worker is not None
    assert QSignalSpy(worker.finished).wait(30000)
    QApplication.processEvents()
    assert calls == ["Saved sentence."]
    assert window._board_source == source
    assert window._board_open_file == output
    assert window.player.source().isEmpty()


def test_whiteboard_example_only_replaces_text_after_confirmation(window, monkeypatch):
    window.editor.setPlainText("Keep my text.")
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.No)
    window._board_example()
    assert window.editor.toPlainText() == "Keep my text."
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.Yes)
    window._board_example()
    assert window.dialogue_mode()
    assert window.editor.toPlainText().startswith("# التحيات")


@pytest.mark.parametrize("text", ["Intro [1] Hello.", "Intro [/1] Hello."])
def test_single_mode_inline_markers_show_a_warning_before_synthesis(
    window, voice_files, monkeypatch, text
):
    add_test_voice(window, voice_files)
    messages = []
    monkeypatch.setattr(QMessageBox, "warning", lambda *args: messages.append(args[-1]))
    window.editor.setPlainText(text)
    assert window._input() is None
    assert "حوار" in messages[-1]
    assert window.worker is None


def test_inline_paired_dialogue_input_preserves_both_voice_choices(window, bilingual_cast):
    add_bilingual_voices(window, bilingual_cast)
    window.primary_voice.language_combo.setCurrentIndex(1)
    window.secondary_voice.language_combo.setCurrentIndex(2)
    window.mode_combo.setCurrentIndex(1)
    window.editor.setPlainText("[1] مرحبًا.[/1][2] Hello.[/2]")
    assert window.generate_button.isEnabled()
    assert set(window._input()[1]) == {1, 2}


def test_reassigning_paired_paragraph_and_undo_keep_valid_closing_tags(window):
    original = "[1] Hello world.[/1]"
    window.editor.setPlainText(original)
    window._tag_paragraph(2)
    assert window.editor.toPlainText() == "[2] Hello world."
    window.editor.undo()
    assert window.editor.toPlainText() == original


def test_tagging_invalid_closing_marker_warns_without_changing_the_editor(window, monkeypatch):
    messages = []
    monkeypatch.setattr(QMessageBox, "warning", lambda *args: messages.append(args[-1]))
    window.editor.setPlainText("[/1] Hello.")
    window._tag_paragraph(2)
    assert window.editor.toPlainText() == "[/1] Hello."
    assert messages
    assert window.worker is None
