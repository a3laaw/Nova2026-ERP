"""Native library UI integration; deliberately skipped without Qt host libraries."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets", exc_type=ImportError)

import test_ui as native  # noqa: E402
from PySide6.QtWidgets import QDialog, QMessageBox  # noqa: E402

from nova_voice.lesson_library import LessonLibrary, LibraryMetadata  # noqa: E402
from nova_voice.library_picker import LibrarySaveDialog, LibrarySaveValues  # noqa: E402

qapp, window = native.qapp, native.window


def fake_save_dialog(monkeypatch, *, accepted=True, title="درس العلوم", update=True, notes=""):
    class FakeDialog:
        def __init__(self, parent, **kwargs):
            self.kwargs = kwargs

        def exec(self):
            return (
                QDialog.DialogCode.Accepted if accepted else QDialog.DialogCode.Rejected
            )

        def result_values(self):
            preselect_id = self.kwargs.get("preselect_id")
            update_id = preselect_id if update and preselect_id else None
            return LibrarySaveValues(
                title=title,
                metadata=LibraryMetadata(
                    country="الكويت",
                    stage="الإعدادية",
                    grade="الأول الإعدادي",
                    academic_year="2025/2026",
                    subject="علوم",
                    term="الترم الأول",
                ),
                notes=notes,
                update_id=update_id,
            )

    monkeypatch.setattr("nova_voice.ui.LibrarySaveDialog", FakeDialog)


def export_file(tmp_path, name="out.html"):
    path = tmp_path / name
    path.write_text("<html>lesson</html>", encoding="utf-8")
    return path


def test_library_tab_is_registered(window):
    texts = [window.workspace_tabs.tabText(i) for i in range(window.workspace_tabs.count())]
    assert texts[-1] == "مكتبة المنهج"
    assert window.library_panel.library is window.lesson_library


def test_completed_export_offers_save_and_archives_copy(window, tmp_path, monkeypatch):
    source = export_file(tmp_path)
    fake_save_dialog(monkeypatch, accepted=True, title="درس دورة المياه")
    window.editor.setPlainText("# دورة المياه\nتبخر ثم تكثف.")
    window._offer_library_save(source, "whiteboard", "درس دورة المياه")
    assert window.lesson_library.count() == 1
    entry = window.lesson_library.list()[0]
    assert entry.title == "درس دورة المياه" and entry.kind == "whiteboard"
    assert entry.metadata.subject == "علوم" and entry.metadata.country == "الكويت"
    assert entry.script.startswith("# دورة المياه")
    stored = window.lesson_library.entry_file(entry.id, entry.files[0].filename)
    assert stored.read_text(encoding="utf-8") == "<html>lesson</html>"
    # Original export may be deleted/moved without breaking the entry.
    source.unlink()
    assert stored.is_file()


def test_declining_the_dialog_saves_nothing(window, tmp_path, monkeypatch):
    source = export_file(tmp_path)
    fake_save_dialog(monkeypatch, accepted=False)
    window._offer_library_save(source, "audio", "صوت")
    assert window.lesson_library.count() == 0


def test_editing_an_entry_overwrites_it_instead_of_duplicating(window, tmp_path, monkeypatch):
    source = export_file(tmp_path)
    fake_save_dialog(monkeypatch, accepted=True, title="النسخة الأولى")
    window._offer_library_save(source, "whiteboard", "النسخة الأولى")
    entry = window.lesson_library.list()[0]
    old_main = entry.files[0].filename
    # Re-enter edit mode for the same entry and export again.
    window._editing_entry_id = entry.id
    replacement = export_file(tmp_path, "edited.html")
    fake_save_dialog(monkeypatch, accepted=True, title="النسخة المحدثة", update=True)
    window._offer_library_save(replacement, "whiteboard", "تجاهل العنوان المقترح")
    assert window.lesson_library.count() == 1
    updated = window.lesson_library.list()[0]
    assert updated.id == entry.id
    assert updated.title == "النسخة المحدثة"
    assert updated.files[0].filename != old_main
    assert updated.created_at == entry.created_at


def test_edit_mode_loads_script_and_prefills_subject_and_grade(window, tmp_path):
    source = export_file(tmp_path)
    entry = window.lesson_library.add(
        title="قابل للتعديل",
        kind="whiteboard",
        files={"main": source},
        metadata=LibraryMetadata(subject="جغرافيا", grade="الثالث الإعدادي"),
        script="# درس قابل للتعديل\nمحتوى محفوظ.",
    )
    window._edit_library_entry(entry.id)
    assert window.editor.toPlainText() == "# درس قابل للتعديل\nمحتوى محفوظ."
    assert window.scene_picker.subject.text() == "جغرافيا"
    assert window.scene_picker.grade.text() == "الثالث الإعدادي"
    assert window._editing_entry_id == entry.id
    assert window.workspace_tabs.currentIndex() == 0


def test_edit_entry_without_script_shows_info_and_does_not_switch(window, tmp_path, monkeypatch):
    source = tmp_path / "clip.webm"
    source.write_bytes(b"webm-bytes")
    entry = window.lesson_library.add(
        title="فيديو بلا سكريبت",
        kind="video",
        files={"main": source},
    )
    before = window.editor.toPlainText()
    shown = []
    monkeypatch.setattr(QMessageBox, "information", lambda *args, **kwargs: shown.append(args))
    window._edit_library_entry(entry.id)
    assert shown and window._editing_entry_id is None
    assert window.editor.toPlainText() == before


def test_end_edit_mode_and_delete_reset_editing_state(window, tmp_path):
    source = export_file(tmp_path)
    entry = window.lesson_library.add(
        title="وضع التحرير",
        kind="whiteboard",
        files={"main": source},
        script="# نص",
    )
    window._editing_entry_id = entry.id
    window._cancel_library_edit()
    assert window._editing_entry_id is None
    window._editing_entry_id = entry.id
    window._library_entry_deleted(entry.id)
    assert window._editing_entry_id is None


def seeded_library(tmp_path):
    library = LessonLibrary(tmp_path / "seeded-library")
    source = tmp_path / "seed.html"
    source.write_text("<html>seed</html>", encoding="utf-8")
    library.add(
        title="درس دورة المياه — الفصل الأول",
        kind="whiteboard",
        files={"main": source},
        metadata=LibraryMetadata(
            country="الكويت",
            stage="الإعدادية",
            grade="الأول الإعدادي",
            academic_year="2025/2026",
            subject="علوم",
            term="الترم الأول",
        ),
        script="# دورة المياه",
    )
    return library


def test_save_dialog_shows_the_index_and_preselects_the_edited_entry(tmp_path, qapp):
    library = seeded_library(tmp_path)
    dialog = LibrarySaveDialog(
        None,
        title="درس دورة المياه — الفصل الأول",
        metadata=LibraryMetadata(subject="علوم", grade="الأول الإعدادي"),
        library=library,
        preselect_id=1,
    )
    assert dialog.index_table.rowCount() == 1
    assert dialog._selected_id() == 1
    assert dialog.update_button.isEnabled()
    # Non-matching fields hide the entry again and disable the update path.
    dialog.field_edits["subject"].setText("تاريخ")
    assert dialog._selected_id() is None
    assert not dialog.update_button.isEnabled()
    assert dialog.index_hint.text().startswith("لا توجد إدخالات مطابقة")
    library.close()


def test_save_dialog_update_choice_flows_into_result_values(tmp_path, qapp):
    library = seeded_library(tmp_path)
    dialog = LibrarySaveDialog(
        None,
        title="نسخة محدثة",
        metadata=LibraryMetadata(subject="علوم", grade="الأول الإعدادي"),
        library=library,
    )
    # User clicks the update path with no row selected → nothing happens.
    dialog._choose_update()
    assert dialog.result_values().update_id is None
    dialog.index_table.selectRow(0)
    dialog._choose_update()
    values = dialog.result_values()
    assert values.update_id == 1 and values.title == "نسخة محدثة"
    dialog._choose_new()
    assert dialog.result_values().update_id is None
    library.close()


def test_save_dialog_empty_index_offers_only_new(tmp_path, qapp):
    library = LessonLibrary(tmp_path / "empty-library")
    dialog = LibrarySaveDialog(
        None,
        title="إدخال أول",
        metadata=LibraryMetadata(subject="تاريخ"),
        library=library,
    )
    assert dialog.index_table.rowCount() == 0
    assert not dialog.update_button.isEnabled()
    assert "لا توجد إدخالات مطابقة" in dialog.index_hint.text()
    dialog._choose_new()
    assert dialog.result_values().update_id is None
    library.close()


def test_empty_title_blocks_both_save_paths(tmp_path, qapp, monkeypatch):
    library = seeded_library(tmp_path)
    dialog = LibrarySaveDialog(
        None,
        title="",
        metadata=LibraryMetadata(subject="علوم"),
        library=library,
    )
    warnings = []
    monkeypatch.setattr(QMessageBox, "warning", lambda *a, **k: warnings.append(a))
    # at open the dialog auto-fills «درس رقم N»; the guard matters when the
    # user deliberately clears the field again
    dialog.title_edit.setText("")
    dialog._choose_new()
    dialog._choose_update()
    assert len(warnings) == 2
    assert dialog.result_values().title == ""
    library.close()


def test_video_export_button_tracks_main_file_type(tmp_path, qapp):
    from nova_voice.library_picker import LibraryPanel

    library = LessonLibrary(tmp_path / "video-library")
    html_source = tmp_path / "lesson.html"
    html_source.write_text("<html>lesson</html>", encoding="utf-8")
    video_source = tmp_path / "clip.mp4"
    video_source.write_bytes(bytes(1024))
    library.add(
        title="سبورة الدرس",
        kind="whiteboard",
        files={"main": html_source},
        metadata=LibraryMetadata(subject="علوم"),
        script="# دورة المياه",
    )
    library.add(
        title="فيديو جاهز",
        kind="video",
        files={"main": video_source},
        metadata=LibraryMetadata(subject="علوم"),
    )
    from PySide6.QtCore import Qt as _Qt

    panel = LibraryPanel(library)
    assert panel.video_button.isEnabled() is False
    # Select the HTML entry → export enabled.
    ids = [
        panel.table.item(row, 0).data(_Qt.ItemDataRole.UserRole)
        for row in range(panel.table.rowCount())
    ]
    panel.table.selectRow(ids.index(1))
    panel._update_action_buttons()
    assert panel.video_button.isEnabled() is True
    # Select the video entry → export disabled (it already is a video).
    panel.table.selectRow(ids.index(2))
    panel._update_action_buttons()
    assert panel.video_button.isEnabled() is False
    library.close()


def test_video_export_emits_for_html_entries_only(tmp_path, qapp, monkeypatch):
    from nova_voice.library_picker import LibraryPanel

    library = LessonLibrary(tmp_path / "emit-library")
    html_source = tmp_path / "lesson.html"
    html_source.write_text("<html>lesson</html>", encoding="utf-8")
    library.add(
        title="سبورة",
        kind="whiteboard",
        files={"main": html_source},
        metadata=LibraryMetadata(subject="علوم"),
        script="# درس",
    )
    panel = LibraryPanel(library)
    emitted = []
    panel.videoExportRequested.connect(emitted.append)
    panel.table.selectRow(0)
    panel.request_video_export()
    assert emitted == [1]
    library.close()


def test_video_export_non_html_shows_info(tmp_path, qapp, monkeypatch):
    from nova_voice.library_picker import LibraryPanel

    library = LessonLibrary(tmp_path / "info-library")
    video_source = tmp_path / "clip.webm"
    video_source.write_bytes(bytes(1024))
    library.add(
        title="مقطع",
        kind="video",
        files={"main": video_source},
        metadata=LibraryMetadata(subject="علوم"),
    )
    panel = LibraryPanel(library)
    infos = []
    monkeypatch.setattr(QMessageBox, "information", lambda *a, **k: infos.append(a))
    panel.table.selectRow(0)
    panel.request_video_export()
    assert len(infos) == 1
    library.close()


def organized_seeded_library(tmp_path):
    library = LessonLibrary(
        tmp_path / "organized-seeded-library",
        organized_root=tmp_path / "library_organized",
    )
    source = tmp_path / "seed.html"
    source.write_text("<html>seed</html>", encoding="utf-8")
    library.add(
        title="درس دورة المياه — الفصل الأول",
        kind="whiteboard",
        files={"main": source},
        metadata=LibraryMetadata(
            country="الكويت",
            stage="الثانوية",
            grade="الصف العاشر",
            academic_year="2026/2027",
            subject="علوم",
            term="الترم الأول",
        ),
        script="# دورة المياه",
    )
    return library


def test_dialog_autofills_lesson_number_and_tracks_fields(tmp_path, qapp):
    library = organized_seeded_library(tmp_path)
    dialog = LibrarySaveDialog(
        None,
        title="",
        metadata=LibraryMetadata(
            subject="علوم", grade="الصف العاشر", academic_year="2026/2027"
        ),
        library=library,
    )
    # same grade+subject → next number after the seeded entry
    assert dialog.title_edit.text() == "درس رقم 2"
    # changing المادة recomputes the suggestion (no entries there yet)
    dialog.field_edits["subject"].setText("رياضيات")
    assert dialog.title_edit.text() == "درس رقم 1"
    # a title the user typed is never clobbered by the suggestion
    dialog.field_edits["subject"].setText("علوم")
    assert dialog.title_edit.text() == "درس رقم 2"
    dialog.title_edit.setText("دورة الماء")
    dialog.field_edits["subject"].setText("تاريخ")
    assert dialog.title_edit.text() == "دورة الماء"
    library.close()


def test_dialog_editing_entry_never_rewrites_title(tmp_path, qapp):
    library = organized_seeded_library(tmp_path)
    dialog = LibrarySaveDialog(
        None,
        title="درس رقم 1",
        metadata=LibraryMetadata(subject="علوم", grade="الصف العاشر"),
        library=library,
        preselect_id=1,
    )
    dialog.field_edits["subject"].setText("تاريخ")
    assert dialog.title_edit.text() == "درس رقم 1"
    library.close()


def test_dialog_path_preview_shows_organized_destination(tmp_path, qapp):
    library = organized_seeded_library(tmp_path)
    dialog = LibrarySaveDialog(
        None,
        title="دورة المياه",
        metadata=LibraryMetadata(
            country="الكويت",
            stage="الثانوية",
            grade="الصف العاشر",
            academic_year="2026/2027",
            subject="علوم",
            term="الترم الأول",
        ),
        library=library,
    )
    preview = dialog.path_preview.text()
    assert "library_organized" in preview
    assert "2026-2027" in preview
    assert "دورة المياه" in preview
    # selecting the matching index row switches the preview to the update target
    dialog.index_table.selectRow(0)
    dialog._update_buttons()
    assert "يستبدل" in dialog.path_preview.text()
    library.close()


def test_dialog_path_preview_reports_unavailable_organized_root(tmp_path, qapp):
    library = LessonLibrary(tmp_path / "plain-library")  # no organized root configured
    dialog = LibrarySaveDialog(
        None,
        title="درس",
        metadata=LibraryMetadata(subject="علوم"),
        library=library,
    )
    assert "بنية المكتبة" in dialog.path_preview.text()
    library.close()
