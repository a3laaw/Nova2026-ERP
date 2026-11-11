"""Headless tests for the local lesson library (no Qt, no network)."""


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
