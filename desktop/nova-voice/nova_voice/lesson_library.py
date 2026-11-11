"""Local lesson library: an on-device index of everything Nova Voice produces.

The library copies completed outputs (whiteboards, audio, HTML pages, videos,
print files…) into its own directory inside the application data folder and
indexes them in SQLite with the six educational fields every entry carries:
الدولة (country), المرحلة الدراسية (stage), الصف الدراسي (grade),
السنة الدراسية (academic year), المادة الدراسية (subject), الترم الدراسي (term).
All fields are free text; the app never invents or translates values.

Guarantees:
- files are copied in, so moving or deleting the original export never breaks an entry;
- nothing is uploaded, scanned, or discovered on the disk — only files the caller
  explicitly passes are copied;
- nothing outside the library root is ever deleted;
- editing an entry («تحديث نفس الإدخال») replaces the stored files atomically
  enough that a failed update leaves the previous entry untouched.
"""

import hashlib
import os
import shutil
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

MAX_TITLE_CHARACTERS = 200
MAX_FIELD_CHARACTERS = 120
MAX_NOTES_CHARACTERS = 500
MAX_SCRIPT_CHARACTERS = 500_000
MAX_FILE_BYTES = 512 * 1024 * 1024  # 512 MiB per file
KINDS = (
    "whiteboard",
    "whiteboard-audio",
    "html-page",
    "audio",
    "video",
    "print",
    "other",
)
_META_FIELDS = ("country", "stage", "grade", "academic_year", "subject", "term")
_KIND_SQL = "', '".join(KINDS)


class LibraryError(Exception):
    """A library entry could not be stored, read, updated, or removed."""


def _clean_single_line(value: object, limit: int, what: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise LibraryError(f"{what}: قيمة غير صالحة.")
    text = value.strip()
    if len(text) > limit:
        raise LibraryError(f"{what}: الحد الأقصى {limit} حرفًا.")
    for char in text:
        code = ord(char)
        if code < 32 or 0xD800 <= code <= 0xDFFF:
            raise LibraryError(f"{what}: يحتوي على محارف غير صالحة.")
    return text


def _clean_multiline(value: object, limit: int, what: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise LibraryError(f"{what}: قيمة غير صالحة.")
    text = value.strip()
    if len(text) > limit:
        raise LibraryError(f"{what}: الحد الأقصى {limit} حرفًا.")
    for char in text:
        code = ord(char)
        if (code < 32 and char not in "\n\t") or 0xD800 <= code <= 0xDFFF:
            raise LibraryError(f"{what}: يحتوي على محارف غير صالحة.")
    return text


def _require_title(value: object) -> str:
    title = _clean_single_line(value, MAX_TITLE_CHARACTERS, "العنوان")
    if not title:
        raise LibraryError("اكتب عنوانًا للإدخال في المكتبة.")
    return title


def _require_kind(value: object) -> str:
    kind = _clean_single_line(value, 40, "النوع")
    if kind not in KINDS:
        raise LibraryError(f"نوع غير معروف: {kind or '(فارغ)'}.")
    return kind


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _safe_filename(name: object) -> str:
    """Keep a readable (possibly Arabic) name; strip anything path-like."""
    text = str(name or "").replace("\\", "/").split("/")[-1].strip().lstrip(".")
    text = "".join("_" if ord(c) < 32 or c in '<>:"|?*\x7f' else c for c in text).strip()
    if not text:
        text = "file"
    if len(text) > 120:
        stem, sep, suffix = text.rpartition(".")
        text = (stem[:100] + "." + suffix[:19]) if sep and len(suffix) <= 19 else text[:120]
    return text


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _unique_name(directory: Path, name: str) -> str:
    candidate, counter = name, 1
    while (directory / candidate).exists():
        stem, dot, suffix = name.rpartition(".")
        candidate = f"{stem}-{counter}{dot}{suffix}" if dot else f"{name}-{counter}"
        counter += 1
    return candidate


@dataclass(frozen=True)
class LibraryMetadata:
    """The six educational fields; every value is free text and may stay empty."""

    country: str = ""
    stage: str = ""
    grade: str = ""
    academic_year: str = ""
    subject: str = ""
    term: str = ""

    @classmethod
    def create(cls, **values: object) -> "LibraryMetadata":
        return cls(
            **{
                field_name: _clean_single_line(
                    values.get(field_name), MAX_FIELD_CHARACTERS, field_name
                )
                for field_name in _META_FIELDS
            }
        )

    def as_dict(self) -> dict:
        return {field_name: getattr(self, field_name) for field_name in _META_FIELDS}


@dataclass(frozen=True)
class FileRecord:
    role: str
    filename: str
    size: int
    sha256: str


@dataclass(frozen=True)
class LibraryEntry:
    id: int
    title: str
    kind: str
    created_at: str
    updated_at: str
    metadata: LibraryMetadata
    script: str
    notes: str
    files: tuple


def _normalize_files(files: object) -> list:
    if files is None:
        return []
    items = files.items() if isinstance(files, dict) else files
    normalized = []
    for role, source in items:
        role_text = _clean_single_line(role or "main", 40, "دور الملف") or "main"
        source_path = Path(source)
        try:
            is_file = source_path.is_file()
            size = source_path.stat().st_size if is_file else 0
        except OSError as error:
            raise LibraryError(f"تعذر قراءة الملف {source_path}: {error}") from error
        if not is_file:
            raise LibraryError(f"الملف غير موجود: {source_path}")
        if size > MAX_FILE_BYTES:
            raise LibraryError(f"الملف أكبر من الحد (512 MiB): {source_path.name}")
        normalized.append((role_text, source_path, size))
    if not normalized:
        raise LibraryError("مرّر ملفًا واحدًا على الأقل للحفظ في المكتبة.")
    if len(normalized) != len({role for role, _, _ in normalized}):
        # The same role may not replace itself twice in one call.
        roles = [role for role, _, _ in normalized]
        if len(set(roles)) != len(roles):
            raise LibraryError("دور الملف مكرر في نفس العملية.")
    return normalized


class LessonLibrary:
    """SQLite index + copied files. Local only; never touches the network."""

    def __init__(self, root) -> None:
        self.root = Path(root)
        self.entries_dir = self.root / "entries"
        self.entries_dir.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(self.root / "index.sqlite3")
        self._db.row_factory = sqlite3.Row
        with self._db:
            self._db.execute("PRAGMA foreign_keys = ON")
            self._db.execute("PRAGMA journal_mode = WAL")
            self._db.execute(
                f"""
                CREATE TABLE IF NOT EXISTS entries (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  kind TEXT NOT NULL CHECK (kind IN ('{_KIND_SQL}')),
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
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS files (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
                  role TEXT NOT NULL,
                  filename TEXT NOT NULL,
                  size INTEGER NOT NULL,
                  sha256 TEXT NOT NULL
                )
                """
            )
            self._db.execute(
                "CREATE INDEX IF NOT EXISTS idx_files_entry ON files(entry_id)"
            )
            self._db.execute(
                "CREATE INDEX IF NOT EXISTS idx_entries_updated ON entries(updated_at)"
            )

    # ------------------------------------------------------------------ API
    def close(self) -> None:
        self._db.close()

    def __enter__(self) -> "LessonLibrary":
        return self

    def __exit__(self, *_args) -> None:
        self.close()

    def add(self, *, title, kind, files, metadata=None, script="", notes="") -> LibraryEntry:
        title = _require_title(title)
        kind = _require_kind(kind)
        metadata = self._metadata(metadata)
        script = _clean_multiline(script, MAX_SCRIPT_CHARACTERS, "السكريبت")
        notes = _clean_multiline(notes, MAX_NOTES_CHARACTERS, "الملاحظات")
        staged = _normalize_files(files)
        staging, records, entry_id = None, [], None
        final_dir = None
        try:
            staging, records = self._stage(staged)
            with self._db:
                timestamp = _now()
                cursor = self._db.execute(
                    """
                    INSERT INTO entries
                      (title, kind, created_at, updated_at, country, stage, grade,
                       academic_year, subject, term, script, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        title,
                        kind,
                        timestamp,
                        timestamp,
                        *[metadata.as_dict()[field_name] for field_name in _META_FIELDS],
                        script,
                        notes,
                    ),
                )
                entry_id = cursor.lastrowid
                final_dir = self.entries_dir / str(entry_id)
                os.replace(staging, final_dir)
                staging = None
                for record in records:
                    self._db.execute(
                        "INSERT INTO files (entry_id, role, filename, size, sha256) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (entry_id, record.role, record.filename, record.size, record.sha256),
                    )
        except LibraryError:
            self._discard(staging, final_dir)
            raise
        except (OSError, sqlite3.Error) as error:
            self._discard(staging, final_dir)
            raise LibraryError(f"تعذر حفظ الإدخال في المكتبة: {error}") from error
        finally:
            if staging is not None:
                shutil.rmtree(staging, ignore_errors=True)
        return self.get(entry_id)

    def update(
        self,
        entry_id,
        *,
        title=None,
        kind=None,
        files=None,
        metadata=None,
        script=None,
        notes=None,
    ) -> LibraryEntry:
        """Overwrite an entry in place («تحديث نفس الإدخال»).

        New files are staged outside the entry and moved in under collision-proof
        names; the database row is swapped only after the files are in place, and
        stale files of replaced roles are removed last. A failure anywhere before
        the commit leaves the previous entry fully intact.
        """
        entry_id = self._entry_id(entry_id)
        current = self.get(entry_id)
        if current is None:
            raise LibraryError("الإدخال غير موجود في المكتبة.")
        new_title = _require_title(title) if title is not None else current.title
        new_kind = _require_kind(kind) if kind is not None else current.kind
        new_metadata = self._metadata(metadata) if metadata is not None else current.metadata
        new_script = (
            _clean_multiline(script, MAX_SCRIPT_CHARACTERS, "السكريبت")
            if script is not None
            else current.script
        )
        new_notes = (
            _clean_multiline(notes, MAX_NOTES_CHARACTERS, "الملاحظات")
            if notes is not None
            else current.notes
        )
        staged = _normalize_files(files) if files is not None else []
        final_dir = self.entries_dir / str(entry_id)
        staging = None
        moved: list = []
        try:
            if staged:
                staging, staged_records = self._stage(staged, unique=True)
                final_dir.mkdir(parents=True, exist_ok=True)
                for record in staged_records:
                    target = final_dir / record.filename
                    os.replace(staging / record.filename, target)
                    moved.append((record, target))
            old_filenames = []
            with self._db:
                if moved:
                    roles = sorted({record.role for record, _ in moved})
                    placeholders = ", ".join("?" for _ in roles)
                    old_filenames = [
                        row["filename"]
                        for row in self._db.execute(
                            "SELECT filename FROM files "
                            f"WHERE entry_id = ? AND role IN ({placeholders})",
                            (entry_id, *roles),
                        ).fetchall()
                    ]
                    self._db.execute(
                        f"DELETE FROM files WHERE entry_id = ? AND role IN ({placeholders})",
                        (entry_id, *roles),
                    )
                timestamp = _now()
                self._db.execute(
                    """
                    UPDATE entries SET title = ?, kind = ?, updated_at = ?,
                      country = ?, stage = ?, grade = ?, academic_year = ?,
                      subject = ?, term = ?, script = ?, notes = ?
                    WHERE id = ?
                    """,
                    (
                        new_title,
                        new_kind,
                        timestamp,
                        *[new_metadata.as_dict()[field_name] for field_name in _META_FIELDS],
                        new_script,
                        new_notes,
                        entry_id,
                    ),
                )
                for record, _target in moved:
                    self._db.execute(
                        "INSERT INTO files (entry_id, role, filename, size, sha256) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (entry_id, record.role, record.filename, record.size, record.sha256),
                    )
            for filename in old_filenames:
                try:
                    (final_dir / filename).unlink(missing_ok=True)
                except OSError:
                    pass  # Orphaned stale file; the new index is already consistent.
        except LibraryError:
            for _record, target in moved:
                try:
                    target.unlink(missing_ok=True)
                except OSError:
                    pass
            raise
        except (OSError, sqlite3.Error) as error:
            for _record, target in moved:
                try:
                    target.unlink(missing_ok=True)
                except OSError:
                    pass
            raise LibraryError(f"تعذر تحديث الإدخال: {error}") from error
        finally:
            if staging is not None:
                shutil.rmtree(staging, ignore_errors=True)
        return self.get(entry_id)

    def delete(self, entry_id) -> None:
        entry_id = self._entry_id(entry_id)
        if self.get(entry_id) is None:
            raise LibraryError("الإدخال غير موجود في المكتبة.")
        with self._db:
            self._db.execute("DELETE FROM entries WHERE id = ?", (entry_id,))
        shutil.rmtree(self.entries_dir / str(entry_id), ignore_errors=True)

    def get(self, entry_id) -> LibraryEntry | None:
        entry_id = self._entry_id(entry_id)
        row = self._db.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
        if row is None:
            return None
        files = tuple(
            FileRecord(row_file["role"], row_file["filename"], row_file["size"], row_file["sha256"])
            for row_file in self._db.execute(
                "SELECT role, filename, size, sha256 FROM files WHERE entry_id = ? ORDER BY id",
                (entry_id,),
            ).fetchall()
        )
        return self._entry(row, files)

    def list(self, *, query="", filters: LibraryMetadata | None = None, kind=None) -> list:
        where, params = [], []
        if filters is not None:
            metadata = self._metadata(filters)
            for field_name in _META_FIELDS:
                value = getattr(metadata, field_name)
                if value:
                    where.append(f"LOWER({field_name}) = LOWER(?)")
                    params.append(value)
        if kind:
            where.append("kind = ?")
            params.append(_require_kind(kind))
        text = _clean_single_line(query, MAX_TITLE_CHARACTERS, "البحث")
        if text:
            escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            like = f"%{escaped}%"
            where.append(
                "(LOWER(title) LIKE LOWER(?) ESCAPE '\\' "
                "OR LOWER(subject) LIKE LOWER(?) ESCAPE '\\' "
                "OR LOWER(notes) LIKE LOWER(?) ESCAPE '\\')"
            )
            params.extend([like, like, like])
        sql = "SELECT * FROM entries"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY updated_at DESC, id DESC"
        rows = self._db.execute(sql, params).fetchall()
        if not rows:
            return []
        ids = [row["id"] for row in rows]
        placeholders = ", ".join("?" for _ in ids)
        files_by_id: dict[int, list] = {entry_id: [] for entry_id in ids}
        for row_file in self._db.execute(
            f"SELECT entry_id, role, filename, size, sha256 FROM files "
            f"WHERE entry_id IN ({placeholders}) ORDER BY id",
            ids,
        ).fetchall():
            files_by_id[row_file["entry_id"]].append(
                FileRecord(
                    row_file["role"], row_file["filename"], row_file["size"], row_file["sha256"]
                )
            )
        return [self._entry(row, tuple(files_by_id[row["id"]])) for row in rows]

    def facets(self) -> dict:
        """Distinct non-empty values per educational field, for filter dropdowns."""
        facets = {}
        for field_name in _META_FIELDS:
            rows = self._db.execute(
                f"SELECT DISTINCT {field_name} AS value FROM entries "
                f"WHERE {field_name} <> '' ORDER BY value COLLATE NOCASE"
            ).fetchall()
            facets[field_name] = [row["value"] for row in rows]
        return facets

    def count(self) -> int:
        return int(self._db.execute("SELECT COUNT(*) FROM entries").fetchone()[0])

    def entry_dir(self, entry_id) -> Path:
        return self.entries_dir / str(self._entry_id(entry_id))

    def entry_file(self, entry_id, filename) -> Path:
        directory = self.entry_dir(entry_id).resolve()
        path = (directory / _safe_filename(filename)).resolve()
        if path.parent != directory:
            raise LibraryError("اسم الملف خارج مجلد الإدخال.")
        return path

    def main_file(self, entry: LibraryEntry) -> FileRecord | None:
        if not entry.files:
            return None
        for record in entry.files:
            if record.role == "main":
                return record
        return entry.files[0]

    # -------------------------------------------------------------- helpers
    @staticmethod
    def _metadata(metadata) -> LibraryMetadata:
        if metadata is None:
            return LibraryMetadata()
        if isinstance(metadata, LibraryMetadata):
            return LibraryMetadata.create(**metadata.as_dict())
        if isinstance(metadata, dict):
            return LibraryMetadata.create(**metadata)
        raise LibraryError("حقول المكتبة غير صالحة.")

    @staticmethod
    def _entry_id(entry_id) -> int:
        try:
            value = int(entry_id)
        except (TypeError, ValueError):
            raise LibraryError("رقم الإدخال غير صالح.") from None
        if value <= 0:
            raise LibraryError("رقم الإدخال غير صالح.")
        return value

    @staticmethod
    def _entry(row, files) -> LibraryEntry:
        metadata = LibraryMetadata(
            **{field_name: row[field_name] for field_name in _META_FIELDS}
        )
        return LibraryEntry(
            id=row["id"],
            title=row["title"],
            kind=row["kind"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            metadata=metadata,
            script=row["script"],
            notes=row["notes"],
            files=tuple(files),
        )

    def _stage(self, staged, unique: bool = False):
        """Copy files into a fresh staging directory; return (staging, records)."""
        staging = self.entries_dir / f".incoming-{uuid.uuid4().hex}"
        staging.mkdir(parents=True)
        records = []
        for role, source, size in staged:
            name = _safe_filename(source.name)
            if unique:
                stem, dot, suffix = name.rpartition(".")
                token = uuid.uuid4().hex[:8]
                name = f"{stem}-{token}{dot}{suffix}" if dot else f"{name}-{token}"
            else:
                name = _unique_name(staging, name)
            try:
                shutil.copy2(source, staging / name)
            except OSError as error:
                shutil.rmtree(staging, ignore_errors=True)
                raise LibraryError(f"تعذر نسخ الملف {source.name}: {error}") from error
            records.append(FileRecord(role, name, size, _sha256(staging / name)))
        return staging, records

    @staticmethod
    def _discard(staging, final_dir) -> None:
        if staging is not None:
            shutil.rmtree(staging, ignore_errors=True)
        if final_dir is not None:
            shutil.rmtree(final_dir, ignore_errors=True)


