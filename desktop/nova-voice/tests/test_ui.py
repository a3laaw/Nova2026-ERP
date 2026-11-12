"""Run natively on Windows; headless Linux needs Qt's system GL/EGL libraries."""

import os
import shutil
import time

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets", exc_type=ImportError)

from PySide6.QtCore import Qt  # noqa: E402
from PySide6.QtWidgets import QApplication, QMessageBox  # noqa: E402

from nova_voice.ui import MainWindow  # noqa: E402
from nova_voice.voices import Cancelled  # noqa: E402


def wait_for_worker(worker, timeout_ms: int = 120000) -> bool:
    """Pump the Qt event loop until the background worker finishes.

    QSignalSpy.wait spins a local loop that does not reliably yield the GIL to
    the worker's Python thread on every platform — the worker can starve until
    the timeout while sitting idle. Processing events while sleeping does
    release the GIL, so the worker always gets scheduled. Returns False only
    when the worker genuinely outlives the timeout.
    """
    deadline = time.monotonic() + timeout_ms / 1000
    while worker.isRunning():
        if time.monotonic() >= deadline:
            return False
        QApplication.processEvents()
        time.sleep(0.02)
    QApplication.processEvents()
    return True


@pytest.fixture(scope="session")
def qapp():
    app = QApplication.instance() or QApplication([])
    app.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
    app.setQuitOnLastWindowClosed(False)
    return app


@pytest.fixture
def window(qapp, tmp_path, monkeypatch):
    monkeypatch.setattr("nova_voice.ui.application_dir", lambda: tmp_path / "app")
    # Keep the organized-library root inside the sandbox — never the real profile.
    monkeypatch.setattr(
        "nova_voice.ui.library_organized_dir",
        lambda base=None: tmp_path / "app" / "library_organized",
    )
    widget = MainWindow(tmp_path / "data")
    yield widget
    if widget.worker:
        widget.worker.cancel_event.set()
        wait_for_worker(widget.worker)
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
    assert wait_for_worker(worker)
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
    assert wait_for_worker(worker)
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
    assert wait_for_worker(worker)
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


def test_whiteboard_step_one_does_not_need_any_voice(window, tmp_path, monkeypatch):
    from PySide6.QtWidgets import QFileDialog

    from nova_voice.whiteboard import WhiteboardPage

    window.editor.setPlainText("# Lesson\n## First\nHello.")
    assert window.create_board_button.isEnabled()
    output = tmp_path / "board.html"
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(output), ""))
    window.generate_whiteboard()
    worker = window.worker
    assert worker is not None
    assert wait_for_worker(worker)
    QApplication.processEvents()
    assert window.worker is None
    assert window.open_html_button.isEnabled()
    assert window.player.source().isEmpty()
    assert WhiteboardPage.load(output).lesson.title == "Lesson"


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
    assert wait_for_worker(worker)
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
    assert window.combined_board_button.text() == "سبورة مع صوت"
    window.editor.setPlainText("# Lesson\n## Step\nHello.")
    assert window.create_board_button.isEnabled()
    assert not window.combined_board_button.isEnabled()
    add_test_voice(window, voice_files)
    assert window.combined_board_button.isEnabled()
    assert window.create_board_button.isEnabled()
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
    assert wait_for_worker(worker)
    QApplication.processEvents()
    assert window.worker is None and len(dialogs) == 1
    assert window._html_result_file == output
    assert window.open_html_button.isEnabled()
    assert window.combined_board_button.isEnabled() and window.create_board_button.isEnabled()
    assert window.player.source().isEmpty()
    assert "ملف HTML واحد" in window.status.text()
    loaded = WhiteboardPage.load(output, allow_recordings=True)
    assert loaded.lesson.script == window.editor.toPlainText()
    assert loaded.timing is not None
    assert loaded.appearance.first_character == "adam"
    assert loaded.appearance.layout == "columns"
    assert list(tmp_path.glob("*.html")) == [output]


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
    assert window.worker is None


def test_combined_job_can_be_cancelled_and_reenables_both_generation_paths(window, voice_files):
    add_test_voice(window, voice_files)
    window.editor.setPlainText("# Lesson\nHello.")

    def wait_for_cancel(cancel, progress):
        cancel.wait(30)
        raise Cancelled()

    window._start_task(wait_for_cancel, "whiteboard-combined")
    worker = window.worker
    assert not window.combined_board_button.isEnabled()
    assert not window.create_board_button.isEnabled()
    window.generate_whiteboard_with_audio()  # A second click cannot replace the running worker.
    assert window.worker is worker
    window._cancel()
    assert wait_for_worker(worker)
    QApplication.processEvents()
    assert window.worker is None
    assert window.combined_board_button.isEnabled() and window.create_board_button.isEnabled()
    assert "الإلغاء" in window.status.text()


def test_organized_workspace_keeps_main_generation_in_the_input_page(window):
    assert [window.workspace_tabs.tabText(i) for i in range(3)] == [
        "النص والأصوات",
        "استدلال",
        "مكتبة المنهج",
    ]
    assert window.workspace_tabs.widget(0).isAncestorOf(window.editor)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.mode_combo)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.format_combo)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.primary_voice)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.secondary_voice)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.scene_toggle_button)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.create_board_button)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.combined_board_button)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.generate_button)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.scenes_board_button)
    assert window.workspace_tabs.widget(0).isAncestorOf(window.preview_button)
    assert not window.workspace_tabs.isAncestorOf(window.appearance_picker)
    assert not window.workspace_tabs.isAncestorOf(window.cancel_button)
    assert not window.workspace_tabs.isAncestorOf(window.result_section)


def test_four_generation_buttons_are_equal_weight_main_buttons(window):
    widgets = [
        window.combined_board_button,
        window.create_board_button,
        window.generate_button,
        window.scenes_board_button,
    ]
    for widget in widgets:
        assert widget.objectName() == "primary"
        assert widget.minimumHeight() == widgets[0].minimumHeight()
    assert [widget.text() for widget in widgets] == [
        "سبورة مع صوت",
        "سبورة فقط",
        "صوت فقط",
        "سبورة مع صوت مع مشاهد ذكية",
    ]


def test_scenes_button_asks_for_approval_and_opens_the_section_instead_of_exporting(
    window, voice_files, monkeypatch
):
    add_test_voice(window, voice_files)
    window.editor.setPlainText("# Lesson\n## Step\nHello.")
    assert window.scenes_board_button.isEnabled()
    assert not window.scene_toggle_button.isChecked()
    messages = []
    monkeypatch.setattr(QMessageBox, "information", lambda *a, **k: messages.append(a[-1]))
    window.scenes_board_button.click()
    assert window.worker is None
    assert len(messages) == 1 and "مشاهد" in messages[0]
    assert window.scene_toggle_button.isChecked()
    assert not window.scene_section.content.isHidden()


def test_scenes_button_exports_like_combined_when_a_plan_is_approved(
    window, bilingual_cast, tmp_path, monkeypatch
):
    from PySide6.QtWidgets import QFileDialog

    # The bundled example lesson is Arabic; the cross-language guard (dabe88e)
    # refuses an English narrator, so install the bilingual fixture and pin the
    # Arabic primary voice — the same arrangement as the other Arabic-lesson tests.
    add_bilingual_voices(window, bilingual_cast)
    window.primary_voice.language_combo.setCurrentIndex(1)
    window._scene_example()
    window.scene_toggle_button.setChecked(True)
    monkeypatch.setattr(
        QMessageBox, "question", lambda *args, **kwargs: QMessageBox.StandardButton.Yes
    )
    window.scene_picker._approve()
    assert window.scenes_board_button.isEnabled()
    window.format_combo.setCurrentIndex(1)
    output = tmp_path / "combined-with-scenes.html"
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *a, **k: (str(output), ""))
    window.scenes_board_button.click()
    worker = window.worker
    assert worker is not None
    assert wait_for_worker(worker)
    QApplication.processEvents()
    assert window.worker is None
    assert output.is_file()
    from nova_voice.whiteboard import WhiteboardPage

    loaded = WhiteboardPage.load(output, allow_recordings=True)
    assert loaded.lesson.visuals is not None


def test_scene_summary_tracks_approval_state(window, monkeypatch):
    assert "لا توجد خطة معتمدة" in window._scene_summary_text()
    window._scene_example()
    assert "بانتظار الاعتماد" in window._scene_summary_text()
    monkeypatch.setattr(
        QMessageBox, "question", lambda *args, **kwargs: QMessageBox.StandardButton.Yes
    )
    window.scene_picker._approve()
    summary = window._scene_summary_text()
    assert "خطة مشاهد معتمدة ✓" in summary and "خطوات" in summary


def test_native_disclosures_keep_settings_and_editor_state_when_tabs_change(window):
    assert window.voice_tuning.content.isHidden()
    assert window.appearance_picker.sentence_section.content.isHidden()
    assert window.result_section.content.isHidden()
    window.voice_tuning.set_expanded(True)
    window.speed_slider.setValue(115)
    window.pause_spin.setValue(250)
    window.voice_tuning.set_expanded(False)
    window.editor.setPlainText("# Keep me\nHello.")
    for index in (1, 2, 0):
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
    assert not window.workspace_tabs.isEnabled()
    assert window.cancel_button.isEnabled() and not window.cancel_button.isHidden()
    assert window.result_section.isEnabled()
    window._cancel()
    assert wait_for_worker(worker)
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


def test_composition_is_reviewed_without_requiring_expert_json_or_part_selection(
    window, monkeypatch
):
    from pathlib import Path

    from nova_voice.scenes import VisualPlan

    root = Path(__file__).resolve().parents[1] / "examples"
    window.editor.setPlainText((root / "composition-demo-script.txt").read_text(encoding="utf-8"))
    source = window._source_lesson()
    panel = window.scene_picker
    plan = VisualPlan.load(root / "composition-demo.json", source.manifest())
    panel.set_draft(plan)
    assert panel.advanced_section.content.isHidden()
    assert panel.plan_edit.toPlainText() and "مفصل سفلي" in panel.review.toPlainText()
    assert panel._approved is None and not window.create_board_button.isEnabled()
    assert window.worker is None and window.player.source().isEmpty()
    monkeypatch.setattr(
        QMessageBox, "question", lambda *args, **kwargs: QMessageBox.StandardButton.Yes
    )
    panel._approve()  # No manual JSON edit, actor selector or library picker.
    assert panel._approved == plan
    assert window.create_board_button.isEnabled()
    assert window._lesson_for_export().visuals == plan
    assert window._source_lesson() == source


def test_composition_preview_stays_silent_and_never_adopts_or_requests_narration(
    window, monkeypatch
):
    from pathlib import Path

    from nova_voice.scenes import VisualPlan
    from nova_voice.whiteboard import WhiteboardPage

    root = Path(__file__).resolve().parents[1] / "examples"
    window.editor.setPlainText((root / "composition-demo-script.txt").read_text(encoding="utf-8"))
    source = window._source_lesson()
    panel, opened = window.scene_picker, []
    panel.set_draft(VisualPlan.load(root / "composition-demo.json", source.manifest()))
    monkeypatch.setattr(
        "nova_voice.scene_picker.QDesktopServices.openUrl", lambda url: opened.append(url) or True
    )
    panel._preview()
    assert len(opened) == 1
    page = WhiteboardPage.load(Path(opened[0].toLocalFile()))
    assert page.lesson.visuals is not None
    assert '<script id="nova-whiteboard-recordings"' not in page.page.content
    assert panel._approved is None and window.worker is None
    assert window.player.source().isEmpty() and window._source_lesson() == source


def secondary_draft(window):
    from pathlib import Path

    from nova_voice.scenes import VisualPlan

    root = Path(__file__).resolve().parents[1] / "examples"
    window.editor.setPlainText((root / "secondary-source-script.txt").read_text(encoding="utf-8"))
    panel = window.scene_picker
    panel.set_draft(
        VisualPlan.load(root / "secondary-source-demo.json", window._source_lesson().manifest())
    )
    return panel


def test_secondary_assets_are_script_selected_and_local_preparation_does_not_consent_to_download(
    window, monkeypatch
):
    panel = secondary_draft(window)
    requests = []
    panel.assets_requested.disconnect()
    panel.assets_requested.connect(requests.append)
    monkeypatch.setattr(
        QMessageBox, "question", lambda *args, **kwargs: pytest.fail("implicit permission")
    )
    panel._prepare_assets(False)
    assert len(requests) == 1 and requests[0].allow_download is False
    assert requests[0].source == window._source_lesson().manifest()
    assert requests[0].revision == panel.revision
    assert panel._approved is None and window.worker is None and window.player.source().isEmpty()
    assert (
        not panel.allow_assets.isChecked()
    )  # Imports never opt into subsequent network proposals.


def test_secondary_download_requires_its_own_new_explicit_confirmation(window, monkeypatch):
    panel = secondary_draft(window)
    requests, notices = [], []
    panel.assets_requested.disconnect()
    panel.assets_requested.connect(requests.append)
    monkeypatch.setattr(
        QMessageBox, "question", lambda *args, **kwargs: QMessageBox.StandardButton.No
    )
    panel._prepare_assets(True)
    assert not requests

    def allow(*args, **kwargs):
        notices.append(args[2])
        return QMessageBox.StandardButton.Yes

    monkeypatch.setattr(QMessageBox, "question", allow)
    panel._prepare_assets(True)
    assert len(requests) == 1 and requests[0].allow_download is True
    assert "CC BY 3.0" in notices[0] and "api.github.com" in notices[0]
    assert "gi-magnifying-glass" in notices[0] and "Icons made by Lorc" in notices[0]


def test_prepared_assets_are_new_silent_drafts_and_stale_work_is_never_adopted(window):
    from threading import Event

    from nova_voice.secondary_assets import prepare_plan

    panel = secondary_draft(window)
    requests = []
    panel.assets_requested.disconnect()
    panel.assets_requested.connect(requests.append)
    panel._prepare_assets(False)
    request = requests[0]
    result = prepare_plan(
        request.plan,
        request.source,
        Event(),
        lambda _: None,
        directory=window.data_dir / "secondary-assets-v1",
    )
    panel._approved = request.plan
    panel.apply_assets(result, request)
    assert panel._approved is None
    assert window.player.source().isEmpty() and window.worker is None
    with pytest.raises(Exception, match="تغيّرت"):
        panel.apply_assets(result, request)


def test_secondary_native_fallback_removes_resources_only_and_keeps_source_and_voices(window):
    panel = secondary_draft(window)
    original, cast = window._source_lesson(), window._cast()
    panel._local_assets()
    current = panel._current()[1]
    assert "resources" not in current.to_data()
    assert "asset_id" in current.payload_json and panel._approved is None
    assert window._source_lesson() == original and window._cast() == cast


def test_review_choices_are_real_native_buttons_and_sacred_mode_disables_them(window):
    window._scene_example()
    panel = window.scene_picker
    assert "هذا المطلوب" in panel.approve_button.text()
    assert panel.another_button.isEnabled() and panel.external_button.isEnabled()
    assert panel.another_button.height() == panel.external_button.height() == 40
    assert panel.approve_button.height() == 48
    panel.policy.setCurrentIndex(1)
    assert not panel.another_button.isEnabled() and not panel.external_button.isEnabled()


def test_review_another_needs_setup_but_never_opens_a_teacher_resource_picker(window, monkeypatch):
    window._scene_example()
    panel, requests, warnings = window.scene_picker, [], []
    panel.revision_requested.disconnect()
    panel.revision_requested.connect(requests.append)
    monkeypatch.setattr(QMessageBox, "warning", lambda *args: warnings.append(args[-1]))
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: pytest.fail("not configured"))
    panel._revise("another")
    panel.adult.setChecked(True)
    panel._revise("another")
    assert not requests and len(warnings) == 2
    assert "مفتاح" in warnings[-1] and not panel.cloud_section.content.isHidden()
    assert window.worker is None and window.player.source().isEmpty()


def test_declining_a_review_choice_does_not_consume_key_or_change_the_old_plan(window, monkeypatch):
    window._scene_example()
    panel, requests = window.scene_picker, []
    panel.revision_requested.disconnect()
    panel.revision_requested.connect(requests.append)
    panel.key.setText("test-only-NOT-A-REAL-KEY")
    panel.adult.setChecked(True)
    _, old = panel._current()
    panel._approved = old
    before = panel.revision
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.No)
    panel._revise("another")
    assert not requests and panel.revision == before and panel._approved == old
    assert panel.key.text() == "test-only-NOT-A-REAL-KEY"


def test_another_choice_snapshots_feedback_and_revokes_approval_without_rewriting_text(
    window, monkeypatch
):
    window._scene_example()
    panel, requests, notices = window.scene_picker, [], []
    panel.revision_requested.disconnect()
    panel.revision_requested.connect(requests.append)
    panel.feedback.setText("وضّح الأجزاء المتحركة")
    panel.key.setText("test-only-NOT-A-REAL-KEY")
    panel.adult.setChecked(True)
    old, cast = window._source_lesson(), window._cast()
    panel._approved = panel._current()[1]

    def accept(*args):
        notices.append(args[2])
        return QMessageBox.StandardButton.Yes

    monkeypatch.setattr(QMessageBox, "question", accept)
    panel._revise("another")
    assert len(requests) == 1 and requests[0].feedback == "وضّح الأجزاء المتحركة"
    assert requests[0].send_consent and not requests[0].download_consent
    assert requests[0].revision == panel.revision and "OpenRouter" in notices[0]
    assert panel._approved is None and not panel.key.text() and not panel.consent.isChecked()
    assert window._source_lesson() == old and window._cast() == cast
    assert not window.create_board_button.isEnabled() and window.player.source().isEmpty()


def test_external_choice_prepares_pending_ids_without_model_key_or_manual_files(
    window, monkeypatch
):
    from PySide6.QtWidgets import QFileDialog

    panel = secondary_draft(window)
    requests, notices = [], []
    panel.revision_requested.disconnect()
    panel.revision_requested.connect(requests.append)
    monkeypatch.setattr(
        QFileDialog, "getOpenFileName", lambda *a, **k: pytest.fail("resource picker")
    )

    def accept(*args):
        notices.append(args[2])
        return QMessageBox.StandardButton.Yes

    monkeypatch.setattr(QMessageBox, "question", accept)
    panel.external_button.click()
    assert len(requests) == 1 and requests[0].download_consent
    assert not requests[0].send_consent and not requests[0].key
    assert "لا إرسال سكريبت" in notices[0] and "api.github.com" in notices[0]
    assert "CC BY3.0" in notices[0] and panel._approved is None
    assert window.worker is None and window.player.source().isEmpty()


def test_optional_review_key_is_not_saved_and_source_edit_forget_and_cleanup_clear_it(
    window, monkeypatch
):
    from dataclasses import asdict

    window._scene_example()
    panel, requests = window.scene_picker, []
    panel.requested.disconnect()
    panel.requested.connect(requests.append)
    panel.remember_review_key.setChecked(True)
    panel.key.setText("test-only-NOT-A-REAL-KEY")
    panel.adult.setChecked(True)
    panel.consent.setChecked(True)
    panel._request()
    fingerprint = panel._credential_fingerprint(window._source_lesson().manifest())
    assert panel._review_credential.get(fingerprint) == "test-only-NOT-A-REAL-KEY"
    assert not panel.key.text() and "test-only" not in repr(asdict(window.preferences))
    panel._forget_review_key()
    assert not panel._review_credential.get(fingerprint)
    panel._review_credential.remember("test-only-NOT-A-REAL-KEY", fingerprint)
    window.editor.insertPlainText(" Changed.")
    assert not panel._review_credential.get(fingerprint)
    panel._review_credential.remember("test-only-NOT-A-REAL-KEY", fingerprint)
    panel.cleanup()
    assert not panel._review_credential.get(fingerprint)


def test_revision_result_opens_new_silent_preview_and_stale_feedback_result_is_rejected(
    window, monkeypatch
):
    from pathlib import Path

    from nova_voice.scene_revision import RevisionRequest, RevisionResult
    from nova_voice.scenes import VisualPlan
    from nova_voice.timing import data_fingerprint
    from nova_voice.whiteboard import WhiteboardPage

    window._scene_example()
    panel, opened = window.scene_picker, []
    source, previous = panel._current()
    changed = previous.to_data()
    changed["steps"][0]["elements"][0]["x"] += 10
    changed = VisualPlan.from_data(changed, source.manifest())
    request = RevisionRequest(source.manifest(), previous, panel.revision, "another")
    result = RevisionResult(
        data_fingerprint(previous.to_data()),
        source.manifest()["fingerprint"],
        "another",
        changed,
        True,
        changed=True,
    )
    monkeypatch.setattr(
        "nova_voice.scene_picker.QDesktopServices.openUrl", lambda url: opened.append(url) or True
    )
    panel.apply_revision(result, request)
    assert len(opened) == 1 and panel._approved is None
    page = WhiteboardPage.load(Path(opened[0].toLocalFile()))
    assert page.lesson.visuals == changed
    assert '<script id="nova-whiteboard-recordings"' not in page.page.content
    assert window.player.source().isEmpty() and not window.create_board_button.isEnabled()
    assert window._source_lesson() == source
    panel.feedback.setText("تعديل جديد")
    with pytest.raises(Exception, match="قديمة"):
        panel.apply_revision(result, request)


# Native-only integration for scoped edits/history. Pure invariants and real
# browser comparisons run separately when Qt system libraries are unavailable.
def history_draft(window):
    from nova_voice.scenes import VisualPlan, empty_plan

    window.editor.setPlainText("# History lesson\n## First\nA first cue.\n## Second\nA second cue.")
    source = window._source_lesson()
    data = empty_plan(source.manifest())
    for i, step in enumerate(data["steps"]):
        step["elements"] = [dict(kind="circle", row=0, x=100 + i * 250, y=100, r=30)]
    original = VisualPlan.from_data(data, source.manifest())
    window.scene_picker.set_draft(original)
    data["steps"][1]["elements"][0]["x"] += 30
    changed = VisualPlan.from_data(data, source.manifest())
    return window.scene_picker, source, original, changed


def test_scope_picker_is_optional_actual_source_scenes_and_not_an_asset_template(window):
    panel, source, _, _ = history_draft(window)
    assert panel.revision_scope.currentData() is None
    assert panel.revision_scope.count() == len(source.steps) + 1
    assert panel.revision_scope.itemData(1) == 0 and panel.revision_scope.itemData(2) == 1
    assert source.steps[1].title in panel.revision_scope.itemText(2)
    assert panel.revision_scope.maxVisibleItems() == 8
    assert panel.revision_scope.isEnabled()
    panel.policy.setCurrentIndex(1)
    assert not panel.revision_scope.isEnabled()


def test_targeted_native_choice_snapshots_scope_and_discloses_only_selected_content(
    window, monkeypatch
):
    panel, source, original, _ = history_draft(window)
    requests, notices = [], []
    panel.revision_requested.disconnect()
    panel.revision_requested.connect(requests.append)
    panel.revision_scope.setCurrentIndex(2)
    panel.adult.setChecked(True)
    panel.key.setText("test-only-NOT-A-REAL-KEY")
    panel._approved = original
    cast = window._cast()

    def accept(*args):
        notices.append(args[2])
        return QMessageBox.StandardButton.Yes

    monkeypatch.setattr(QMessageBox, "question", accept)
    panel.another_button.click()
    assert len(requests) == 1 and requests[0].target_step == 1
    assert requests[0].previous == original and requests[0].source == source.manifest()
    assert "المشهد 2 فقط" in notices[0] and "لا باقي النص" in notices[0]
    assert "سيُرسل نص وخطة المشهد المختار" in notices[0]
    assert panel._approved is None and window._source_lesson() == source
    assert window._cast() == cast and window.player.source().isEmpty() and window.worker is None


def test_scope_switch_rejects_even_a_valid_scoped_result_without_opening_preview(
    window, monkeypatch
):
    from nova_voice.scene_revision import RevisionRequest, RevisionResult
    from nova_voice.timing import data_fingerprint

    panel, source, original, changed = history_draft(window)
    panel.revision_scope.setCurrentIndex(2)
    request = RevisionRequest(source.manifest(), original, panel.revision, "another", target_step=1)
    result = RevisionResult(
        data_fingerprint(original.to_data()),
        source.manifest()["fingerprint"],
        "another",
        changed,
        True,
        changed=True,
        target_step=1,
    )
    panel.revision_scope.setCurrentIndex(1)
    monkeypatch.setattr(
        "nova_voice.scene_picker.QDesktopServices.openUrl", lambda *a: pytest.fail("stale")
    )
    with pytest.raises(Exception, match="قديمة"):
        panel.apply_revision(result, request)
    assert panel._current()[1] == original


def test_native_comparison_opens_actual_local_silent_frames_and_preserves_current_approval(
    window, monkeypatch
):
    from pathlib import Path

    panel, source, original, changed = history_draft(window)
    panel.set_draft(changed)
    panel._approved = changed
    panel.history_choice.setCurrentIndex(0)
    opened = []
    monkeypatch.setattr(
        "nova_voice.scene_picker.QDesktopServices.openUrl", lambda url: opened.append(url) or True
    )
    revision, cast = panel.revision, window._cast()
    panel.compare_history_button.click()
    assert len(opened) == 1 and opened[0].isLocalFile()
    page = Path(opened[0].toLocalFile()).read_text(encoding="utf-8")
    assert page.count('sandbox="allow-scripts"') == 2 and "data:text/html;base64," in page
    assert panel._approved == changed and panel.revision == revision
    assert (
        panel._current()[1] == changed
        and window._source_lesson() == source
        and window._cast() == cast
    )
    assert (
        len(panel.history.entries) == 2
        and window.worker is None
        and window.player.source().isEmpty()
    )


def test_native_restore_revokes_approval_and_pending_results_but_preserves_source_and_voices(
    window, monkeypatch
):
    from pathlib import Path

    from nova_voice.whiteboard import WhiteboardPage

    panel, source, original, changed = history_draft(window)
    panel.set_draft(changed)
    panel._approved = changed
    panel.consent.setChecked(True)
    panel.history_choice.setCurrentIndex(0)
    cast, opened = window._cast(), []
    revision = panel.revision
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.Yes)
    monkeypatch.setattr(
        "nova_voice.scene_picker.QDesktopServices.openUrl", lambda url: opened.append(url) or True
    )
    panel.restore_history_button.click()
    assert panel._current()[1] == original and panel._approved is None
    assert panel.revision > revision and not panel.consent.isChecked()
    assert (
        len(opened) == 1
        and WhiteboardPage.load(Path(opened[0].toLocalFile())).lesson.visuals == original
    )
    assert len(panel.history.entries) == 2 and panel.history.current.plan == original
    assert panel.redo_history_button.isEnabled() and not panel.undo_history_button.isEnabled()
    assert window._source_lesson() == source and window._cast() == cast
    assert not window.create_board_button.isEnabled() and window.player.source().isEmpty()


def test_declining_restore_keeps_plan_and_approval_and_does_not_open_a_page(window, monkeypatch):
    panel, _, _, changed = history_draft(window)
    panel.set_draft(changed)
    panel._approved = changed
    panel.history_choice.setCurrentIndex(0)
    revision = panel.revision
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.No)
    monkeypatch.setattr(
        "nova_voice.scene_picker.QDesktopServices.openUrl", lambda *a: pytest.fail("declined")
    )
    panel.restore_history_button.click()
    assert (
        panel._current()[1] == changed and panel._approved == changed and panel.revision == revision
    )


def test_native_history_previous_next_do_not_duplicate_or_discard_saved_proposals(
    window, monkeypatch
):
    panel, _, original, changed = history_draft(window)
    panel.set_draft(changed)
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.Yes)
    monkeypatch.setattr("nova_voice.scene_picker.QDesktopServices.openUrl", lambda *a: True)
    panel.undo_history_button.click()
    assert panel._current()[1] == original and panel.history.can_redo
    panel.redo_history_button.click()
    assert panel._current()[1] == changed and len(panel.history.entries) == 2
    assert panel._approved is None and window.player.source().isEmpty()


def test_valid_manual_json_edits_checkpoint_on_review_not_each_keystroke(window):
    panel, _, _, changed = history_draft(window)
    assert len(panel.history.entries) == 1
    panel.plan_edit.setPlainText(changed.to_json())
    assert len(panel.history.entries) == 1
    panel._review()
    assert len(panel.history.entries) == 2 and panel.history.current.plan == changed
    panel._review()
    assert len(panel.history.entries) == 2


def test_native_restore_can_recover_invalid_json_only_after_explicit_confirmation(
    window, monkeypatch
):
    panel, source, original, _ = history_draft(window)
    panel.plan_edit.setPlainText('{"broken":')
    assert panel._approved is None and len(panel.history.entries) == 1
    notices = []

    def accept(*args):
        notices.append(args[2])
        return QMessageBox.StandardButton.Yes

    monkeypatch.setattr(QMessageBox, "question", accept)
    monkeypatch.setattr("nova_voice.scene_picker.QDesktopServices.openUrl", lambda *a: True)
    panel.restore_history_button.click()
    assert panel._current()[1] == original and "JSON غير صالح" in notices[0]
    assert panel._approved is None and window._source_lesson() == source


def test_history_is_cleared_on_source_and_context_change_not_on_visual_keystrokes(window):
    panel, _, _, changed = history_draft(window)
    panel.set_draft(changed)
    panel.subject.setText("علوم")
    assert not panel.history.entries and not panel.restore_history_button.isEnabled()
    panel._review()
    assert len(panel.history.entries) == 1
    window.editor.insertPlainText(" Changed source.")
    assert not panel.history.entries and panel.revision_scope.currentData() is None
    assert panel.revision_scope.count() == 1


def test_manual_narration_change_starts_new_history_instead_of_restoring_other_reviewed_text(
    window,
):
    from nova_voice.scenes import VisualPlan

    panel, source, _, _ = history_draft(window)
    data = panel._current()[1].to_data()
    data["steps"][1]["rows"] = [
        dict(index=0, display="Different display", speech="Different speech.")
    ]
    panel.plan_edit.setPlainText(VisualPlan.from_data(data, source.manifest()).to_json())
    panel._review()
    assert len(panel.history.entries) == 1 and not panel.history.can_undo


def test_clearing_history_alone_does_not_change_plan_approval_credentials_or_voices(
    window, monkeypatch
):
    panel, source, original, _ = history_draft(window)
    panel._approved = original
    panel._review_credential.remember("test-only-NOT-A-REAL-KEY", source.manifest()["fingerprint"])
    cast, revision = window._cast(), panel.revision
    monkeypatch.setattr(QMessageBox, "question", lambda *a, **k: QMessageBox.StandardButton.Yes)
    panel.clear_history_button.click()
    assert not panel.history.entries and panel._approved == original and panel.revision == revision
    assert panel._current()[1] == original and window._cast() == cast
    assert panel._review_credential.get(source.manifest()["fingerprint"])


def test_restore_modal_cannot_apply_after_source_changes_while_confirmation_is_open(
    window, monkeypatch
):
    panel, _, _, changed = history_draft(window)
    panel.set_draft(changed)
    panel.history_choice.setCurrentIndex(0)
    warnings = []

    def mutate(*args, **kwargs):
        window.editor.insertPlainText(" Changed while deciding.")
        return QMessageBox.StandardButton.Yes

    monkeypatch.setattr(QMessageBox, "question", mutate)
    monkeypatch.setattr(QMessageBox, "warning", lambda *args: warnings.append(args[-1]))
    monkeypatch.setattr(
        "nova_voice.scene_picker.QDesktopServices.openUrl", lambda *a: pytest.fail("stale restore")
    )
    panel.restore_history_button.click()
    assert warnings and "تغيّرت" in warnings[0]
    assert panel.plan_edit.toPlainText() == changed.to_json() and not panel.history.entries


def test_main_window_checks_scope_again_before_starting_a_revision_worker(window, monkeypatch):
    from nova_voice.scene_revision import RevisionRequest

    panel, source, original, _ = history_draft(window)
    warnings = []
    # Same revision/source/plan, but not the scope actually selected in the UI.
    request = RevisionRequest(source.manifest(), original, panel.revision, "another", target_step=1)
    monkeypatch.setattr(QMessageBox, "warning", lambda *args: warnings.append(args[-1]))
    window._request_revision(request)
    assert warnings and window.worker is None and window._revision_request is None


def test_auto_row_colors_generate_palette_and_manual_color_wins(window, monkeypatch):
    from nova_voice.appearance import ROW_PALETTE
    from nova_voice.whiteboard import parse_lesson

    picker = window.appearance_picker
    lesson = parse_lesson("# T\n## Step\nOne.\nTwo.", dialogue=False)
    assert picker.auto_row_colors_box.isChecked() is False
    picker.auto_row_colors_box.setChecked(True)
    appearance = picker.snapshot(lesson)
    assert [item.color for item in appearance.row_colors] == list(ROW_PALETTE[:2])
    # يدوي على الجملة الأولى + لوحة على الثانية
    picker._row_colors[(0, 0)] = "#475569"
    picker._fingerprint = lesson.manifest()["fingerprint"]
    appearance = picker.snapshot(lesson)
    by_key = {(item.step, item.row): item.color for item in appearance.row_colors}
    assert by_key == {(0, 0): "#475569", (0, 1): ROW_PALETTE[1]}
    # الإعادة تلغي خيار اللوحة (الألوان تعود كيدوية)
    picker.restore(appearance, lesson)
    assert picker.auto_row_colors_box.isChecked() is False
    assert picker._row_colors == {(0, 0): "#475569", (0, 1): ROW_PALETTE[1]}
