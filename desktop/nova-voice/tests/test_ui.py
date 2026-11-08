"""Run natively on Windows; headless Linux needs Qt's system GL/EGL libraries."""

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
    original = window.engine.render_lines

    def render(lines, *args, **kwargs):
        calls.extend(line.text for line in lines)
        return original(lines, *args, **kwargs)

    monkeypatch.setattr(window.engine, "render_lines", render)
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


def test_native_character_and_sentence_color_choices_round_trip_into_html(
    window, tmp_path, monkeypatch
):
    from PySide6.QtGui import QColor
    from PySide6.QtWidgets import QColorDialog, QFileDialog

    from nova_voice.whiteboard import WhiteboardPage

    window.editor.setPlainText("# Kids\n## Step\nHello children.")
    picker = window.appearance_picker
    picker.first_character.setCurrentIndex(picker.first_character.findData("adam"))
    picker.second_character.setCurrentIndex(picker.second_character.findData("nour"))
    picker.layout_combo.setCurrentIndex(picker.layout_combo.findData("columns"))
    window._refresh_appearance_sentences()
    monkeypatch.setattr(QColorDialog, "getColor", lambda *a, **k: QColor("#475569"))
    picker._choose_sentence_color()
    output = tmp_path / "kids.html"
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(output), ""))
    window.generate_whiteboard()
    worker = window.worker
    assert worker is not None
    assert QSignalSpy(worker.finished).wait(30000)
    QApplication.processEvents()
    loaded = WhiteboardPage.load(output)
    assert loaded.appearance.first_character == "adam"
    assert loaded.appearance.second_character == "nour"
    assert loaded.appearance.layout == "columns"
    assert loaded.appearance.row_colors[0].color == "#475569"
    assert loaded.lesson.spoken_script == "Hello children."


def test_editing_script_invalidates_row_overrides_but_keeps_character_choices(window):
    window.editor.setPlainText("## Step\nHello.")
    picker = window.appearance_picker
    picker.first_character.setCurrentIndex(picker.first_character.findData("salma"))
    window._refresh_appearance_sentences()
    picker._row_colors[(0, 0)] = "#475569"
    window.editor.setPlainText("## Step\nDifferent words.")
    assert picker._row_colors == {}
    assert picker.first_character.currentData() == "salma"
    assert not picker.sentence_color_button.isEnabled()


def test_combined_button_requires_script_and_voices_without_removing_two_step_flow(
    window, voice_files
):
    assert not window.combined_board_button.isEnabled()
    assert window.combined_board_button.text() == "توليد السبورة بالنص والصوت معًا"
    window.editor.setPlainText("# Lesson\n## Step\nHello.")
    assert window.create_board_button.isEnabled()
    assert not window.combined_board_button.isEnabled()
    add_test_voice(window, voice_files)
    assert window.combined_board_button.isEnabled()
    assert window.create_board_button.isEnabled()
    assert not window.board_audio_button.isEnabled()
    window.editor.setPlainText("# Empty title only")
    assert not window.combined_board_button.isEnabled()
    window.editor.clear()
    assert not window.combined_board_button.isEnabled()


def test_combined_button_handles_headings_and_only_used_dialogue_roles(window, voice_files):
    add_test_voice(window, voice_files)
    window.mode_combo.setCurrentIndex(1)
    window.primary_voice.language_combo.setCurrentIndex(1)  # No Arabic model installed.
    window.secondary_voice.language_combo.setCurrentIndex(2)
    window.editor.setPlainText("# Title\n## Step\n[2] Hello.[/2]")
    assert window.primary_voice.selected_voice() is None
    assert window.combined_board_button.isEnabled()
    window.editor.setPlainText("# Title\n## Step\n[1] مرحبًا.[/1][2] Hello.[/2]")
    assert not window.combined_board_button.isEnabled()


def test_combined_click_asks_for_one_output_and_keeps_no_temporary_source(
    window, voice_files, tmp_path, monkeypatch
):
    from PySide6.QtWidgets import QFileDialog

    from nova_voice.whiteboard import WhiteboardPage

    add_test_voice(window, voice_files)
    window.editor.setPlainText("# Together\n## Step\nHello.")
    window.format_combo.setCurrentIndex(1)
    window.appearance_picker.first_character.setCurrentIndex(
        window.appearance_picker.first_character.findData("adam")
    )
    window.appearance_picker.layout_combo.setCurrentIndex(
        window.appearance_picker.layout_combo.findData("columns")
    )
    output, dialogs = tmp_path / "complete.html", []

    def choose(*args, **kwargs):
        dialogs.append(args)
        return str(output), ""

    monkeypatch.setattr(QFileDialog, "getSaveFileName", choose)
    window.combined_board_button.click()
    worker = window.worker
    assert worker is not None
    assert not window.combined_board_button.isEnabled()
    assert not window.create_board_button.isEnabled()
    assert QSignalSpy(worker.finished).wait(30000)
    QApplication.processEvents()
    assert window.worker is None and len(dialogs) == 1
    assert window._board_source is None and window._board_lesson is None
    assert window._board_open_file == window._html_result_file == output
    assert window.open_board_button.isEnabled() and window.open_html_button.isEnabled()
    assert not window.board_audio_button.isEnabled()
    assert window.combined_board_button.isEnabled() and window.create_board_button.isEnabled()
    assert window.player.source().isEmpty()
    assert "ملف HTML واحد" in window.status.text()
    assert "النص والصوت" in window.board_source_label.text()
    loaded = WhiteboardPage.load(output, allow_recordings=True)
    assert loaded.lesson.script == window.editor.toPlainText()
    assert loaded.timing is not None
    assert loaded.appearance.first_character == "adam"
    assert loaded.appearance.layout == "columns"
    assert list(tmp_path.glob("*.html")) == [output]


@pytest.mark.parametrize("source_attribute", ["_board_source", "_html_source"])
def test_combined_export_refuses_to_overwrite_a_selected_original(
    window, voice_files, tmp_path, monkeypatch, source_attribute
):
    from PySide6.QtWidgets import QFileDialog

    add_test_voice(window, voice_files)
    window.editor.setPlainText("# New lesson\nHello.")
    source = tmp_path / "original.html"
    source.write_bytes(b"original untouched page")
    setattr(window, source_attribute, source)
    messages = []
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(source), ""))
    monkeypatch.setattr(QMessageBox, "warning", lambda *a, **k: messages.append(a[-1]))
    window.generate_whiteboard_with_audio()
    assert window.worker is None and len(messages) == 1
    assert source.read_bytes() == b"original untouched page"


def test_combined_export_uses_current_editor_and_preserves_the_old_saved_board_selection(
    window, voice_files, tmp_path, monkeypatch
):
    from PySide6.QtWidgets import QFileDialog

    from nova_voice.whiteboard import WhiteboardPage, parse_lesson, save_whiteboard

    add_test_voice(window, voice_files)
    old_lesson = parse_lesson("# Saved\nOld saved sentence.")
    source, output = tmp_path / "saved.html", tmp_path / "new-combined.html"
    save_whiteboard(old_lesson, source)
    original = source.read_bytes()
    window._board_source, window._board_lesson = source, old_lesson
    window.editor.setPlainText("# Current\nCurrent editor sentence.")
    window.format_combo.setCurrentIndex(1)
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(output), ""))
    monkeypatch.setattr(
        QMessageBox, "question", lambda *a, **k: pytest.fail("Unexpected old-text prompt")
    )
    window.generate_whiteboard_with_audio()
    assert QSignalSpy(window.worker.finished).wait(30000)
    QApplication.processEvents()
    assert WhiteboardPage.load(output, allow_recordings=True).lesson.title == "Current"
    assert window._board_source == source and window._board_lesson == old_lesson
    assert window._board_open_file == output
    assert window.board_audio_button.isEnabled()  # The saved-source step 2 still works.
    assert source.read_bytes() == original


def test_combined_invalid_voice_or_cancelled_save_starts_no_worker(
    window, voice_files, monkeypatch
):
    from PySide6.QtWidgets import QFileDialog

    add_test_voice(window, voice_files)
    messages = []
    window.editor.setPlainText("# Lesson\nنص عربي.")
    monkeypatch.setattr(QMessageBox, "warning", lambda *a, **k: messages.append(a[-1]))
    monkeypatch.setattr(
        QFileDialog,
        "getSaveFileName",
        lambda *a, **k: pytest.fail("Invalid voice opened save dialog"),
    )
    window.generate_whiteboard_with_audio()
    assert window.worker is None and messages
    window.editor.setPlainText("# Lesson\nHello.")
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: ("", ""))
    window.generate_whiteboard_with_audio()
    assert window.worker is None and window._board_source is None


def test_combined_job_can_be_cancelled_and_reenables_both_generation_paths(window, voice_files):
    add_test_voice(window, voice_files)
    window.editor.setPlainText("# Lesson\nHello.")

    def wait_for_cancel(cancel, progress):
        cancel.wait(30)
        raise Cancelled()

    window._start_task(wait_for_cancel, "whiteboard-combined")
    worker = window.worker
    finished = QSignalSpy(worker.finished)
    assert not window.combined_board_button.isEnabled()
    assert not window.create_board_button.isEnabled()
    window.generate_whiteboard_with_audio()  # A second click cannot replace the running worker.
    assert window.worker is worker
    window._cancel()
    assert finished.count() > 0 or finished.wait(30000)
    QApplication.processEvents()
    assert window.worker is None
    assert window.combined_board_button.isEnabled() and window.create_board_button.isEnabled()
    assert "الإلغاء" in window.status.text()


def test_organized_workspace_keeps_main_generation_and_cancellation_outside_tabs(window):
    assert [window.workspace_tabs.tabText(i) for i in range(4)] == [
        "النص والأصوات",
        "ألوان وشخصيات",
        "سبورة محفوظة",
        "صوت فقط / HTML",
    ]
    assert window.workspace_tabs.widget(0).isAncestorOf(window.editor)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.mode_combo)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.format_combo)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.primary_voice)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.secondary_voice)
    assert window.workspace_tabs.widget(1).isAncestorOf(window.appearance_picker)
    assert window.workspace_tabs.widget(2).isAncestorOf(window.create_board_button)
    assert window.workspace_tabs.widget(2).isAncestorOf(window.board_audio_button)
    assert window.workspace_tabs.widget(3).isAncestorOf(window.generate_button)
    assert window.workspace_tabs.widget(3).isAncestorOf(window.html_export_button)
    assert not window.workspace_tabs.isAncestorOf(window.combined_board_button)
    assert not window.workspace_tabs.isAncestorOf(window.cancel_button)
    assert not window.workspace_tabs.isAncestorOf(window.result_section)


def test_native_disclosures_keep_settings_and_editor_state_when_tabs_change(window):
    assert window.voice_tuning.content.isHidden()
    assert window.appearance_picker.sentence_section.content.isHidden()
    assert window.result_section.content.isHidden()
    window.voice_tuning.set_expanded(True)
    window.speed_slider.setValue(115)
    window.pause_spin.setValue(250)
    window.voice_tuning.set_expanded(False)
    window.editor.setPlainText("# Keep me\nHello.")
    for index in (1, 2, 3, 0):
        window.workspace_tabs.setCurrentIndex(index)
    assert window.editor.toPlainText() == "# Keep me\nHello."
    assert window.speed_slider.value() == 115 and window.pause_spin.value() == 250
    window.voice_tuning.set_expanded(True)
    assert not window.voice_tuning.content.isHidden()


def test_job_does_not_disable_the_shared_cancel_or_result_disclosure(window):
    def wait_for_cancel(cancel, progress):
        cancel.wait(30)
        raise Cancelled()

    window._start_task(wait_for_cancel, "whiteboard-combined")
    worker = window.worker
    finished = QSignalSpy(worker.finished)
    assert not window.workspace_tabs.isEnabled()
    assert window.cancel_button.isEnabled() and not window.cancel_button.isHidden()
    assert window.result_section.isEnabled()
    window._cancel()
    assert finished.count() > 0 or finished.wait(30000)
    QApplication.processEvents()
    assert window.workspace_tabs.isEnabled()


def test_success_expands_shared_result_without_moving_or_changing_the_editor(window, tmp_path):
    from nova_voice.whiteboard import parse_lesson, save_whiteboard

    window.editor.setPlainText("My current editor text.")
    window.workspace_tabs.setCurrentIndex(2)
    result = save_whiteboard(parse_lesson("# Result\nHello."), tmp_path / "result.html")
    window._task_success(result)
    assert not window.result_section.content.isHidden()
    assert window.workspace_tabs.currentIndex() == 2
    assert window.editor.toPlainText() == "My current editor text."
    assert window.result_path.toolTip() == str(result.path)
    assert window.open_html_button.isEnabled()


def test_english_model_picker_discloses_uk_us_without_changing_the_selected_model(
    window, voice_files
):
    from dataclasses import replace

    from nova_voice.voices import VoiceSpec

    original = VoiceSpec.from_path(*voice_files)
    uk = replace(original, language_code="en_GB", name="UK test")
    us = replace(original, language_code="en_US", name="US test")
    picker = window.primary_voice
    picker.set_voices([uk, us])
    assert "UK" in picker.voice_combo.itemText(0)
    assert "US" in picker.voice_combo.itemText(1)
    picker.voice_combo.setCurrentIndex(1)
    assert picker.selected_voice() is us
    assert "US" in picker.details.text()
    assert picker.selected_voice().model_path == original.model_path


def test_visual_demo_is_a_draft_until_explicit_teacher_approval(window, monkeypatch):
    window._scene_example()
    panel = window.scene_picker
    assert panel.use_plan.isChecked()
    assert panel._approved is None
    assert not window.create_board_button.isEnabled()
    assert "تفاحتان" in panel.review.toPlainText()
    monkeypatch.setattr(
        QMessageBox, "question", lambda *args, **kwargs: QMessageBox.StandardButton.Yes
    )
    panel._approve()
    assert panel._approved is not None
    assert window.create_board_button.isEnabled()
    assert window._lesson_for_export().manifest()["schema"] == 2
    assert window._source_lesson().manifest()["schema"] == 1


def test_source_or_json_edits_invalidate_visual_approval_and_network_consent(window, monkeypatch):
    window._scene_example()
    panel = window.scene_picker
    monkeypatch.setattr(
        QMessageBox, "question", lambda *args, **kwargs: QMessageBox.StandardButton.Yes
    )
    panel._approve()
    panel.consent.setChecked(True)
    window.editor.insertPlainText(" Updated.")
    assert panel._approved is None
    assert not panel.consent.isChecked()
    assert not window.create_board_button.isEnabled()
    panel.use_plan.setChecked(False)
    assert window.create_board_button.isEnabled()
    assert window._lesson_for_export().manifest()["schema"] == 1


def test_same_plan_reimport_cannot_inherit_previous_approval(window, monkeypatch):
    window._scene_example()
    panel = window.scene_picker
    monkeypatch.setattr(
        QMessageBox, "question", lambda *args, **kwargs: QMessageBox.StandardButton.Yes
    )
    panel._approve()
    plan = panel._approved
    panel.set_draft(plan)
    assert panel._approved is None
    assert not window.create_board_button.isEnabled()


def test_cloud_snapshot_is_per_request_and_key_is_cleared_without_saving(window, monkeypatch):
    window.editor.setPlainText("A short generic lesson.")
    panel, requests = window.scene_picker, []
    panel.requested.disconnect()
    panel.requested.connect(requests.append)
    panel.key.setText("test-only-NOT-A-REAL-KEY")
    panel.adult.setChecked(True)
    panel.consent.setChecked(True)
    panel._request()
    assert len(requests) == 1
    assert requests[0].consent and requests[0].adult
    assert requests[0].source == window._source_lesson().manifest()
    assert not panel.key.text() and not panel.consent.isChecked()
    assert "test-only" not in repr(requests[0])
    from dataclasses import asdict

    assert "test-only" not in repr(asdict(window.preferences))


def test_cloud_request_needs_consent_and_adult_before_emitting(window, monkeypatch):
    warnings, requests = [], []
    monkeypatch.setattr(QMessageBox, "warning", lambda *args, **kwargs: warnings.append(args))
    window.editor.setPlainText("A short generic lesson.")
    panel = window.scene_picker
    panel.requested.disconnect()
    panel.requested.connect(requests.append)
    panel.key.setText("test-only-NOT-A-REAL-KEY")
    panel._request()
    panel.consent.setChecked(True)
    panel._request()
    assert len(warnings) == 2 and requests == []


def test_visual_result_goes_to_review_not_audio_result_handler(window):
    from nova_voice.scene_examples import VISUAL_EXAMPLE, example_plan

    window.editor.setPlainText(VISUAL_EXAMPLE)
    window._progress_kind = "scene-plan"
    window._task_success(example_plan(window._source_lesson().manifest()))
    assert window.scene_picker._approved is None
    assert window.scene_picker.use_plan.isChecked()
    assert not window.play_button.isEnabled()
    assert "مسودة" in window.status.text()


def test_sacred_mode_blocks_drawings_and_auto_recitation(window, monkeypatch):
    from nova_voice.scenes import VisualPlan, empty_plan

    window.editor.setPlainText("نص مراجع كما كتبه المعلم.")
    panel, source = window.scene_picker, window._source_lesson().manifest()
    data = empty_plan(source)
    data["policy"] = "sacred"
    panel.set_draft(VisualPlan.from_data(data, source))
    monkeypatch.setattr(
        QMessageBox, "question", lambda *args, **kwargs: QMessageBox.StandardButton.Yes
    )
    panel._approve()
    assert panel._approved is not None
    assert not panel.audio_allowed()
    assert window.create_board_button.isEnabled()
    assert not window.combined_board_button.isEnabled()


def test_sacred_authoring_policy_also_guards_audio_only_and_keyboard_paths(window, voice_files):
    from nova_voice.voices import VoiceError

    add_test_voice(window, voice_files)
    window.editor.setPlainText("A reviewed source text.")
    window.scene_picker.policy.setCurrentIndex(1)
    window.scene_picker.use_plan.setChecked(False)
    assert not window.generate_button.isEnabled()
    assert not window.preview_button.isEnabled()
    with pytest.raises(VoiceError):
        window._options()
