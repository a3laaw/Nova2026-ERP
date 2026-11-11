"""Headless tests for the local lesson library (no Qt, no network)."""


from pathlib import Path

import pytest

from nova_voice.lesson_library import (
    KINDS,
    LessonLibrary,
    LibraryError,
    LibraryMetadata,
)


@pytest.fixture
def library(tmp_path):
    lib = LessonLibrary(tmp_path / "library")
    yield lib
    lib.close()


def make_file(tmp_path, name="lesson.html", content=b"<html>lesson</html>"):
    path = tmp_path / name
    path.write_bytes(content)
    return path


def meta(**overrides):
    values = {
        "country": "الكويت",
        "stage": "الإعدادية",
        "grade": "الأول الإعدادي",
        "academic_year": "2025/2026",
        "subject": "علوم",
        "term": "الترم الأول",
    }
    values.update(overrides)
    return LibraryMetadata.create(**values)


def test_add_and_get_roundtrip_copies_file(tmp_path, library):
    source = make_file(tmp_path)
    entry = library.add(
        title="دورة المياه",
        kind="whiteboard",
        files={"main": source},
        metadata=meta(),
        script="# دورة المياه\nتبخر ثم تكثف.",
        notes="مسودة",
    )
    assert entry.id == 1
    assert entry.title == "دورة المياه"
    assert entry.kind == "whiteboard"
    assert entry.metadata.country == "الكويت"
    assert entry.metadata.subject == "علوم"
    assert entry.script.startswith("# دورة المياه")
    assert entry.notes == "مسودة"
    assert len(entry.files) == 1
    record = entry.files[0]
    assert record.role == "main" and record.size == source.stat().st_size
    stored = library.entry_file(entry.id, record.filename)
    assert stored.is_file() and stored.read_bytes() == source.read_bytes()
    assert len(record.sha256) == 64
    # The library keeps its own copy: deleting the export does not break the entry.
    source.unlink()
    assert library.get(entry.id).files[0].filename == record.filename


def test_add_validation_rejects_bad_input(tmp_path, library):
    source = make_file(tmp_path)
    with pytest.raises(LibraryError):
        library.add(title="", kind="whiteboard", files={"main": source})
    with pytest.raises(LibraryError):
        library.add(title="عنوان", kind="hologram", files={"main": source})
    with pytest.raises(LibraryError):
        library.add(title="عنوان", kind="whiteboard", files={"main": tmp_path / "missing.html"})
    with pytest.raises(LibraryError):
        library.add(title="عنوان", kind="whiteboard", files={})
    assert library.count() == 0


def test_add_rejects_unknown_kind_and_preserves_kinds(tmp_path, library):
    source = make_file(tmp_path)
    for kind in KINDS:
        entry = library.add(title=f"مادة {kind}", kind=kind, files={"main": source})
        assert entry.kind == kind


def test_list_filters_each_educational_field(tmp_path, library):
    source = make_file(tmp_path)
    library.add(title="أ", kind="whiteboard", files={"main": source}, metadata=meta())
    library.add(
        title="ب",
        kind="audio",
        files={"main": source},
        metadata=meta(country="السعودية", grade="الخامس الابتدائي", subject="رياضيات"),
    )
    library.add(
        title="ج",
        kind="video",
        files={"main": source},
        metadata=meta(term="الترم الثاني", academic_year="2026/2027"),
    )
    only = LibraryMetadata  # filters include every non-empty field (AND semantics)
    assert [e.title for e in library.list(filters=only(country="الكويت"))] == ["ج", "أ"]
    assert [e.title for e in library.list(filters=only(country="السعودية"))] == ["ب"]
    assert [e.title for e in library.list(filters=only(grade="الخامس الابتدائي"))] == ["ب"]
    assert [e.title for e in library.list(filters=only(term="الترم الثاني"))] == ["ج"]
    assert [e.title for e in library.list(filters=only(academic_year="2026/2027"))] == ["ج"]
    # "ب" also carries the default stage value.
    assert [e.title for e in library.list(filters=only(stage="الإعدادية"))] == [
        "ج", "ب", "أ",
    ]
    assert [e.title for e in library.list(filters=only(subject="رياضيات"))] == ["ب"]
    both = library.list(filters=only(country="الكويت", subject="علوم"))
    assert [e.title for e in both] == ["ج", "أ"]
    # Case-insensitive exact match, not substring.
    assert library.list(filters=only(country="كويت")) == []
    assert [e.title for e in library.list(kind="video")] == ["ج"]


def test_search_query_escapes_like_wildcards(tmp_path, library):
    source = make_file(tmp_path)
    library.add(title="النسبة 100% مئوية", kind="whiteboard", files={"main": source})
    library.add(title="درس عادي", kind="whiteboard", files={"main": source})
    assert [e.title for e in library.list(query="100%")] == ["النسبة 100% مئوية"]
    assert [e.title for e in library.list(query="مئوية")] == ["النسبة 100% مئوية"]
    assert [e.title for e in library.list(query="%")] == ["النسبة 100% مئوية"]  # literal % only
    assert library.list(query="_") == []  # wildcard must not match anything


def test_facets_returns_distinct_sorted_values(tmp_path, library):
    source = make_file(tmp_path)
    library.add(title="1", kind="audio", files={"main": source}, metadata=meta(country="الكويت"))
    library.add(title="2", kind="audio", files={"main": source}, metadata=meta(country="السعودية"))
    library.add(title="3", kind="audio", files={"main": source}, metadata=meta(country="الكويت"))
    library.add(title="4", kind="audio", files={"main": source}, metadata=LibraryMetadata())
    facets = library.facets()
    assert facets["country"] == ["السعودية", "الكويت"] or sorted(facets["country"]) == [
        "الكويت",
        "السعودية",
    ]
    assert facets["grade"] == ["الأول الإعدادي"]
    assert facets["subject"] == ["علوم"]
    assert "" not in facets["term"] or facets["term"] == ["الترم الأول"]


def test_update_replaces_main_file_and_keeps_creation(tmp_path, library):
    first = make_file(tmp_path, "v1.html", b"one")
    entry = library.add(title="قديم", kind="whiteboard", files={"main": first}, metadata=meta())
    created = entry.created_at
    first_name = entry.files[0].filename
    second = make_file(tmp_path, "v2.html", b"two-longer")
    updated = library.update(
        entry.id,
        title="جديد",
        files={"main": second},
        metadata=meta(subject="رياضيات"),
        script="# نص جديد",
    )
    assert updated.title == "جديد"
    assert updated.created_at == created
    assert updated.metadata.subject == "رياضيات"
    assert updated.script == "# نص جديد"
    assert len(updated.files) == 1
    replacement = updated.files[0]
    assert replacement.filename != first_name  # unique staged name
    assert library.entry_file(entry.id, replacement.filename).read_bytes() == b"two-longer"
    # The replaced role's old file is gone; nothing stale remains.
    directory = library.entry_dir(entry.id)
    assert [p.name for p in directory.iterdir()] == [replacement.filename]


def test_update_metadata_only_leaves_files_untouched(tmp_path, library):
    source = make_file(tmp_path, "keep.html", b"keep")
    entry = library.add(title="عنوان", kind="whiteboard", files={"main": source})
    updated = library.update(entry.id, metadata=meta(subject="تاريخ"), notes="ملاحظة")
    assert updated.metadata.subject == "تاريخ"
    assert updated.notes == "ملاحظة"
    assert updated.files == entry.files


def test_failed_update_leaves_previous_entry_intact(tmp_path, library):
    source = make_file(tmp_path, "safe.html", b"safe-content")
    entry = library.add(title="آمن", kind="whiteboard", files={"main": source}, metadata=meta())
    with pytest.raises(LibraryError):
        library.update(entry.id, title="لن تُحفظ", files={"main": tmp_path / "missing.bin"})
    intact = library.get(entry.id)
    assert intact.title == "آمن"
    assert intact.metadata.subject == "علوم"
    stored = library.entry_file(entry.id, intact.files[0].filename)
    assert stored.read_bytes() == b"safe-content"


def test_delete_removes_row_and_files(tmp_path, library):
    source = make_file(tmp_path)
    entry = library.add(title="حذف", kind="audio", files={"main": source})
    directory = library.entry_dir(entry.id)
    assert directory.is_dir()
    library.delete(entry.id)
    assert library.get(entry.id) is None
    assert not directory.exists()
    with pytest.raises(LibraryError):
        library.delete(entry.id)


def test_persistence_across_instances(tmp_path):
    source = make_file(tmp_path)
    first = LessonLibrary(tmp_path / "library")
    entry = first.add(title="مستدام", kind="video", files={"main": source}, metadata=meta())
    first.close()
    second = LessonLibrary(tmp_path / "library")
    try:
        restored = second.get(entry.id)
        assert restored.title == "مستدام"
        assert second.main_file(restored).filename == entry.files[0].filename
        assert [e.title for e in second.list()] == ["مستدام"]
    finally:
        second.close()


def test_entry_file_never_escapes_entry_directory(tmp_path, library):
    source = make_file(tmp_path)
    entry = library.add(title="محصور", kind="whiteboard", files={"main": source})
    path = library.entry_file(entry.id, "../../outside.html")
    assert path.parent == library.entry_dir(entry.id).resolve()


def test_main_file_prefers_main_role(tmp_path, library):
    other = make_file(tmp_path, "other.bin", b"other")
    main = make_file(tmp_path, "main.bin", b"main")
    entry = library.add(
        title="ترتيب",
        kind="other",
        files=[("extra", other), ("main", main)],
    )
    assert library.main_file(entry).role == "main"


def test_metadata_fields_are_cleaned_and_bounded(tmp_path, library):
    source = make_file(tmp_path)
    long_value = "س" * 500
    with pytest.raises(LibraryError):
        library.add(
            title="حد",
            kind="audio",
            files={"main": source},
            metadata=LibraryMetadata(subject=long_value),
        )
    dirty = LibraryMetadata.create(country="  الكويت  ")
    assert dirty.country == "الكويت"


# ---------------------------------------------------- 0.17 organized folders
@pytest.fixture
def organized_library(tmp_path):
    lib = LessonLibrary(tmp_path / "library", organized_root=tmp_path / "library_organized")
    yield lib
    lib.close()


def test_add_to_index_creates_organized_tree_and_records_folder_path(
    tmp_path, organized_library
):
    source = make_file(tmp_path, "board.html")
    entry, fallback = organized_library.add_to_index(
        title="درس رقم 3 — دورة المياه",
        kind="whiteboard",
        files={"main": source},
        metadata=meta(),
        script="# درس\nمحتوى.",
    )
    assert fallback is None
    expected = (
        tmp_path / "library_organized" / "الكويت" / "الإعدادية" / "الأول الإعدادي"
        / "2025-2026" / "علوم" / "الترم الأول" / "درس رقم 3 — دورة المياه"
    )
    assert Path(entry.folder_path) == expected
    assert (expected / entry.files[0].filename).is_file()
    assert not (tmp_path / "library" / "entries" / str(entry.id)).exists()
    assert organized_library.entry_dir(entry.id) == expected
    assert organized_library.entry_file(entry.id, entry.files[0].filename).is_file()


def test_add_to_index_empty_fields_render_general_placeholder(
    tmp_path, organized_library
):
    source = make_file(tmp_path)
    entry, fallback = organized_library.add_to_index(
        title="درس عام", kind="audio", files={"main": source}, metadata=LibraryMetadata(),
    )
    assert fallback is None
    parts = Path(entry.folder_path).parts
    assert parts[-7:] == ("عام", "عام", "عام", "عام", "عام", "عام", "درس عام")


def test_organized_path_sanitizes_dangerous_characters(tmp_path, organized_library):
    path = organized_library.organized_path(
        meta(academic_year="2025/2026", subject='علو:م/فيزياء*'), "درس/\\:*؟\"<>|test"
    )
    assert "/" not in path.name and "\\" not in path.name
    for char in '<>:"|?*':
        assert char not in path.name
    assert Path("2025") / "2026" not in path.parts  # year joined with a dash, not a separator
    assert "2025-2026" in path.parts
    assert "-" in path.parts[-3]


def test_organized_path_rejects_oversized_tree(tmp_path, organized_library):
    long_meta = meta(
        country="ك" * 120, stage="ك" * 120, grade="ك" * 120,
        academic_year="ك" * 120, subject="ك" * 120, term="ك" * 120,
    )
    with pytest.raises(LibraryError):
        organized_library.organized_path(long_meta, "درس " * 60)


def test_add_to_index_falls_back_to_entries_when_folder_cannot_be_created(
    tmp_path, organized_library
):
    blocker = make_file(tmp_path, "blocker", b"not a directory")
    organized_library.organized_root = blocker  # mkdir(parents=True) will fail
    source = make_file(tmp_path)
    entry, fallback = organized_library.add_to_index(
        title="درس احتياطي", kind="whiteboard", files={"main": source}, metadata=meta(),
    )
    assert fallback is not None and "تعذر" in fallback
    assert (tmp_path / "library" / "entries" / str(entry.id)).is_dir()
    assert entry.folder_path is None
    assert source.is_file()


def test_reexport_into_same_folder_never_overwrites_existing_files(
    tmp_path, organized_library
):
    folder_source = make_file(tmp_path, "voice.mp3", b"original-bytes")
    first, _ = organized_library.add_to_index(
        title="درس رقم 1 — الصوت", kind="audio",
        files={"main": folder_source}, metadata=meta(subject="لغة عربية"),
    )
    assert Path(first.folder_path).is_dir()
    stored = Path(first.folder_path) / first.files[0].filename
    assert stored.read_bytes() == b"original-bytes"
    second_source = make_file(tmp_path, "voice.mp3", b"replacement-bytes")
    second, fallback = organized_library.add_to_index(
        title="درس رقم 1 — الصوت", kind="audio",
        files={"main": second_source}, metadata=meta(subject="لغة عربية"),
    )
    assert fallback is None
    assert first.folder_path == second.folder_path
    assert stored.read_bytes() == b"original-bytes"
    second_stored = Path(second.folder_path) / second.files[0].filename
    assert second_stored.read_bytes() == b"replacement-bytes"
    assert second.files[0].filename != first.files[0].filename


def test_suggest_lesson_number_counts_same_grade_and_subject(tmp_path, organized_library):
    assert organized_library.suggest_lesson_number("الأول الإعدادي", "علوم") == 1
    source = make_file(tmp_path)
    for title in ("درس أ", "درس ب"):
        organized_library.add_to_index(
            title=title, kind="audio", files={"main": source}, metadata=meta(),
        )
    assert organized_library.suggest_lesson_number("الأول الإعدادي", "علوم") == 3
    assert organized_library.suggest_lesson_number("الأول الإعدادي", "لغة عربية") == 1
    assert organized_library.suggest_lesson_number("الثاني الثانوي", "علوم") == 1


def test_update_of_organized_entry_updates_in_place(tmp_path, organized_library):
    source = make_file(tmp_path)
    entry, _ = organized_library.add_to_index(
        title="درس رقم 2 — تحديث", kind="audio",
        files={"main": source}, metadata=meta(), script="# قديم",
    )
    replacement = make_file(tmp_path, "new.mp3", b"new-bytes")
    updated = organized_library.update(
        entry.id, files={"main": replacement}, script="# جديد"
    )
    assert updated.folder_path == entry.folder_path
    stored_dir = Path(updated.folder_path)
    files = list(stored_dir.iterdir())
    assert len(files) == 1 and files[0].read_bytes() == b"new-bytes"
    assert updated.script == "# جديد"
    assert updated.metadata.subject == "علوم"


def test_update_legacy_entry_keeps_entries_folder_and_stays_null(tmp_path):
    with LessonLibrary(tmp_path / "library",
                       organized_root=tmp_path / "library_organized") as lib:
        source = make_file(tmp_path)
        entry = lib.add(title="درس قديم", kind="audio",
                        files={"main": source}, metadata=meta())
        updated = lib.update(entry.id, script="# مُحدّث")
        assert updated.folder_path is None
        assert lib.entry_dir(entry.id) == tmp_path / "library" / "entries" / str(entry.id)
        assert updated.script == "# مُحدّث"


def test_folder_path_migration_from_legacy_database(tmp_path):
    import sqlite3

    root = tmp_path / "library"
    root.mkdir()
    legacy = sqlite3.connect(root / "index.sqlite3")
    legacy.execute(
        """
        CREATE TABLE entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('whiteboard', 'whiteboard-audio',
            'html-page', 'audio', 'video', 'print', 'other')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          country TEXT NOT NULL DEFAULT '',
          stage TEXT NOT NULL DEFAULT '',
          grade TEXT NOT NULL DEFAULT '',
          academic_year TEXT NOT NULL DEFAULT '',
          subject TEXT NOT NULL DEFAULT '',
          term TEXT NOT NULL DEFAULT '',
          script TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT ''
        )
        """
    )
    legacy.execute(
        """
        CREATE TABLE files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          filename TEXT NOT NULL,
          size INTEGER NOT NULL,
          sha256 TEXT NOT NULL
        )
        """
    )
    legacy.execute(
        "INSERT INTO entries (title, kind, created_at, updated_at, grade, subject) "
        "VALUES ('درس قديم', 'audio', '2026-01-01T00:00:00', '2026-01-01T00:00:00', "
        "'الأول الإعدادي', 'علوم')"
    )
    legacy.commit()
    legacy.close()

    with LessonLibrary(root, organized_root=tmp_path / "library_organized") as lib:
        entry = lib.get(1)
        assert entry is not None
        assert entry.folder_path is None  # legacy rows remain NULL, untouched
        columns = {row["name"] for row in lib._db.execute("PRAGMA table_info(entries)")}
        assert "folder_path" in columns


def test_delete_organized_entry_removes_its_folder_but_never_the_root(
    tmp_path, organized_library
):
    source = make_file(tmp_path)
    entry, _ = organized_library.add_to_index(
        title="درس رقم 9 — حذف", kind="audio", files={"main": source}, metadata=meta(),
    )
    folder = Path(entry.folder_path)
    assert folder.is_dir()
    organized_library.delete(entry.id)
    assert not folder.exists()
    assert organized_library.organized_root.is_dir()


def test_delete_refuses_to_remove_library_roots(tmp_path, organized_library):
    source = make_file(tmp_path)
    entry, _ = organized_library.add_to_index(
        title="درس رقم 10 — حارس", kind="audio", files={"main": source}, metadata=meta(),
    )
    organized_library._db.execute(
        "UPDATE entries SET folder_path = ? WHERE id = ?",
        (str(organized_library.organized_root), entry.id),
    )
    organized_library._db.commit()
    organized_library.delete(entry.id)
    assert organized_library.organized_root.is_dir()
    assert organized_library.get(entry.id) is None  # row is still removed


def test_add_with_destination_inside_a_file_fails_atomically(
    tmp_path, organized_library
):
    source = make_file(tmp_path)
    blocker = make_file(tmp_path, "blocker-dir", b"not a directory")
    with pytest.raises(LibraryError):
        organized_library.add(
            title="درس مكسور", kind="audio", files={"main": source},
            metadata=meta(), destination=blocker / "sub",
        )
    assert organized_library.count() == 0
    assert list(organized_library.entries_dir.glob(".incoming-*")) == []
