"""Native library UI integration; deliberately skipped without Qt host libraries."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets", exc_type=ImportError)

import test_ui as native  # noqa: E402
from PySide6.QtWidgets import QDialog, QMessageBox  # noqa: E402

from nova_voice.lesson_library import LibraryMetadata  # noqa: E402
from nova_voice.library_picker import LibrarySaveValues  # noqa: E402

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
            update_entry = self.kwargs.get("update_entry")
            update_id = update_entry[0] if update and update_entry else None
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
