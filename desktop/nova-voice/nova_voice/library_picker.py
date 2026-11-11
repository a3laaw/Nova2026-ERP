"""Native Qt widgets for the local lesson library (مكتبة المنهج).

Everything stays on disk in the app's data directory; this module only builds
widgets and delegates persistence to :class:`nova_voice.lesson_library.LessonLibrary`.
"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import Qt, QUrl, Signal
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QDialog,
    QFileDialog,
    QGridLayout,
    QHBoxLayout,
    QHeaderView,
    QLineEdit,
    QMessageBox,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .controls import button, combo, label
from .lesson_library import (
    MAX_FIELD_CHARACTERS,
    MAX_NOTES_CHARACTERS,
    MAX_TITLE_CHARACTERS,
    LessonLibrary,
    LibraryError,
    LibraryMetadata,
)
from .video_export import is_exportable_main

KIND_LABELS = {
    "whiteboard": "سبورة HTML",
    "whiteboard-audio": "سبورة + صوت",
    "html-page": "صفحة HTML",
    "audio": "صوت فقط",
    "video": "فيديو",
    "print": "PDF / طباعة",
    "other": "ملف",
}

FIELD_LABELS = {
    "country": "الدولة",
    "stage": "المرحلة الدراسية",
    "grade": "الصف الدراسي",
    "academic_year": "السنة الدراسية",
    "subject": "المادة الدراسية",
    "term": "الترم الدراسي",
}

FIELD_PLACEHOLDERS = {
    "country": "الدولة · مثال: الكويت — اختياري",
    "stage": "المرحلة · مثال: الإعدادية — اختياري",
    "grade": "الصف · مثال: الأول الإعدادي — اختياري",
    "academic_year": "السنة · مثال: 2025/2026 — اختياري",
    "subject": "المادة · مثال: علوم — اختياري",
    "term": "الترم · مثال: الترم الأول — اختياري",
}

COLUMNS = (
    "العنوان",
    "النوع",
    "الدولة",
    "المرحلة",
    "الصف",
    "السنة",
    "المادة",
    "الترم",
    "آخر تحديث",
)

_FILTER_FIELDS = ("country", "stage", "grade", "academic_year", "subject", "term")
_KIND_BY_SUFFIX = {
    ".html": "html-page",
    ".htm": "html-page",
    ".mp4": "video",
    ".webm": "video",
    ".mkv": "video",
    ".mov": "video",
    ".avi": "video",
    ".mp3": "audio",
    ".wav": "audio",
    ".m4a": "audio",
    ".aac": "audio",
    ".ogg": "audio",
    ".flac": "audio",
    ".pdf": "print",
}


def kind_for_suffix(path: Path) -> str:
    return _KIND_BY_SUFFIX.get(path.suffix.lower(), "other")


@dataclass(frozen=True)
class LibrarySaveValues:
    title: str
    metadata: LibraryMetadata
    notes: str
    update_id: int | None  # not None → overwrite that entry instead of adding a new one


class LibrarySaveDialog(QDialog):
    """Save offer shown after every completed export.

    Shows the matching library index entries (same six educational fields):
    pick one to overwrite in place, or save as a brand-new entry. The index
    is the same one the «مكتبة المنهج» tab browses — nothing is uploaded.
    """

    def __init__(
        self,
        parent,
        *,
        title: str,
        metadata: LibraryMetadata,
        notes: str = "",
        library: LessonLibrary | None = None,
        preselect_id: int | None = None,
        heading: str = "حفظ في مكتبة المنهج؟",
    ):
        super().__init__(parent)
        self.setWindowTitle(heading)
        self.setAccessibleName(heading)
        self.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
        self.setMinimumWidth(560)
        self._library = library
        self._preselect_id = preselect_id
        self._decision = "new"

        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 18, 18, 18)
        layout.setSpacing(10)
        layout.addWidget(label(heading, "section"))
        layout.addWidget(
            label(
                "يُحفظ نسخة من الملف داخل مجلد Nova Voice على هذا الجهاز مع الفهرسة. "
                "كل الحقول أدناه اختيارية ما عدا العنوان؛ اكتب ما يساعدك تجده لاحقًا.",
                "muted",
                True,
            )
        )
        self.title_edit = QLineEdit(title)
        self.title_edit.setMaxLength(MAX_TITLE_CHARACTERS)
        self.title_edit.setAccessibleName("عنوان الإدخال في المكتبة")
        self.title_edit.setPlaceholderText("عنوان الدرس / المادة / الصف")
        layout.addWidget(self.title_edit)

        grid = QGridLayout()
        grid.setHorizontalSpacing(10)
        grid.setVerticalSpacing(6)
        self.field_edits: dict[str, QLineEdit] = {}
        for index, field_name in enumerate(_FILTER_FIELDS):
            edit = QLineEdit(getattr(metadata, field_name))
            edit.setMaxLength(MAX_FIELD_CHARACTERS)
            edit.setPlaceholderText(FIELD_PLACEHOLDERS[field_name])
            edit.setAccessibleName(FIELD_LABELS[field_name])
            edit.textChanged.connect(self._refresh_index)
            self.field_edits[field_name] = edit
            grid.addWidget(label(FIELD_LABELS[field_name]), (index // 2) * 2, index % 2)
            grid.addWidget(edit, (index // 2) * 2 + 1, index % 2)
        layout.addLayout(grid)

        self.notes_edit = QLineEdit(notes)
        self.notes_edit.setMaxLength(MAX_NOTES_CHARACTERS)
        self.notes_edit.setPlaceholderText("ملاحظات · اختياري — مثال: يحتاج مراجعة الإجابات")
        self.notes_edit.setAccessibleName("ملاحظات الإدخال")
        layout.addWidget(self.notes_edit)

        # --- الفهرس: الإدخالات المطابقة لنفس الحقول ---------------------
        if self._library is not None:
            layout.addWidget(label("الفهرس · إدخالات مطابقة لنفس البيانات", "muted"))
            self.index_table = QTableWidget(0, 3)
            self.index_table.setHorizontalHeaderLabels(("العنوان", "النوع", "آخر تحديث"))
            self.index_table.setAccessibleName("الفهرس — الإدخالات المطابقة لنفس الحقول")
            self.index_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
            self.index_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
            self.index_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
            self.index_table.setMaximumHeight(150)
            self.index_table.verticalHeader().setVisible(False)
            index_header = self.index_table.horizontalHeader()
            index_header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
            for column in (1, 2):
                index_header.setSectionResizeMode(column, QHeaderView.ResizeMode.ResizeToContents)
            self.index_table.itemSelectionChanged.connect(self._update_buttons)
            self.index_table.itemDoubleClicked.connect(lambda _item: self._choose_update())
            layout.addWidget(self.index_table)
            self.index_hint = label("", "muted", True)
            layout.addWidget(self.index_hint)
        else:
            self.index_table = None
            self.index_hint = None

        actions = QHBoxLayout()
        self.new_button = button("حفظ كإدخال جديد", "primary")
        self.new_button.setToolTip(
            "ينشئ إدخالًا جديدًا بالحقول أعلاه؛ الإدخالات السابقة تبقى كما هي."
        )
        self.new_button.clicked.connect(self._choose_new)
        self.update_button = button("تحديث الإدخال المحدّد (استبدال)")
        self.update_button.setToolTip(
            "يستبدل الملف والبيانات والسكريبت للإدخال المحدّد؛ يُحذف ملفه القديم بعد نجاح التحديث."
        )
        self.update_button.clicked.connect(self._choose_update)
        self.skip_button = button("تخطي هذه المرة")
        self.skip_button.clicked.connect(self.reject)
        actions.addWidget(self.new_button, 1)
        actions.addWidget(self.update_button)
        actions.addWidget(self.skip_button)
        layout.addLayout(actions)
        self._refresh_index()

    # ----------------------------------------------------------------
    def _filters(self) -> LibraryMetadata:
        return LibraryMetadata.create(
            **{name: edit.text() for name, edit in self.field_edits.items()}
        )

    def _matching_entries(self):
        if self._library is None:
            return []
        try:
            matches = list(self._library.list(filters=self._filters()))
        except Exception as error:  # index is a convenience; never block saving
            self.index_hint.setText(f"تعذرت قراءة الفهرس: {error}")
            return []
        # The entry currently being edited stays selectable even if the user
        # changed the metadata fields away from its stored values.
        if (
            self._preselect_id is not None
            and all(entry.id != self._preselect_id for entry in matches)
        ):
            try:
                editing = self._library.get(self._preselect_id)
            except Exception:
                editing = None
            if editing is not None:
                matches.insert(0, editing)
        return matches

    def _refresh_index(self, *_args) -> None:
        if self.index_table is None:
            return
        entries = self._matching_entries()
        self.index_table.blockSignals(True)
        self.index_table.setRowCount(len(entries))
        preselected_row = -1
        for row, entry in enumerate(entries):
            meta = entry.metadata
            values = (
                entry.title,
                KIND_LABELS.get(entry.kind, entry.kind),
                self._format_timestamp(entry.updated_at),
            )
            tooltip = (
                f"الدولة: {meta.country or '—'}\nالمرحلة: {meta.stage or '—'}\n"
                f"الصف: {meta.grade or '—'}\nالسنة: {meta.academic_year or '—'}\n"
                f"المادة: {meta.subject or '—'}\nالترم: {meta.term or '—'}"
            )
            for column, value in enumerate(values):
                item = QTableWidgetItem(str(value))
                item.setToolTip(tooltip)
                if column == 0:
                    item.setData(Qt.ItemDataRole.UserRole, entry.id)
                self.index_table.setItem(row, column, item)
            if self._preselect_id is not None and entry.id == self._preselect_id:
                preselected_row = row
        if preselected_row >= 0:
            self.index_table.selectRow(preselected_row)
        self.index_table.blockSignals(False)
        if entries:
            self.index_hint.setText(
                f"{len(entries)} إدخالًا مطابقًا — انقر صفًا لاختياره ثم «تحديث الإدخال المحدّد»، "
                "أو انقر مرتين على الصف، أو احفظه كإدخال جديد."
            )
        else:
            self.index_hint.setText("لا توجد إدخالات مطابقة — سيُنشأ إدخال جديد.")
        self._update_buttons()

    def _update_buttons(self) -> None:
        if self.update_button is None:
            return
        self.update_button.setEnabled(
            self.index_table is not None and self._selected_id() is not None
        )

    def _selected_id(self) -> int | None:
        if self.index_table is None:
            return None
        row = self.index_table.currentRow()
        if row < 0:
            return None
        item = self.index_table.item(row, 0)
        if item is None:
            return None
        value = item.data(Qt.ItemDataRole.UserRole)
        return int(value) if value is not None else None

    @staticmethod
    def _format_timestamp(value: str) -> str:
        try:
            return datetime.fromisoformat(value).strftime("%Y-%m-%d %H:%M")
        except ValueError:
            return value

    def _title_or_warn(self) -> str | None:
        title = self.title_edit.text().strip()
        if not title:
            QMessageBox.warning(self, "العنوان مطلوب", "اكتب عنوانًا للإدخال في المكتبة.")
            return None
        return title

    def _choose_new(self) -> None:
        if self._title_or_warn() is None:
            return
        self._decision = "new"
        self.accept()

    def _choose_update(self) -> None:
        if self._title_or_warn() is None:
            return
        if self._selected_id() is None:
            QMessageBox.information(
                self, "اختر من الفهرس", "انقر صفًا من الفهرس أولًا، أو احفظه كإدخال جديد."
            )
            return
        self._decision = "update"
        self.accept()

    def result_values(self) -> LibrarySaveValues:
        metadata = self._filters()
        update_id = self._selected_id() if self._decision == "update" else None
        return LibrarySaveValues(
            title=self.title_edit.text().strip(),
            metadata=metadata,
            notes=self.notes_edit.text().strip(),
            update_id=update_id,
        )


class LibraryPanel(QWidget):
    """The «مكتبة المنهج» tab: filter, open, edit, add, or delete entries."""

    editRequested = Signal(int)
    entryDeleted = Signal(int)
    editCancelled = Signal()
    videoExportRequested = Signal(int)

    def __init__(self, library: LessonLibrary, parent=None):
        super().__init__(parent)
        self.library = library
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        # --- filters -----------------------------------------------
        filter_grid = QGridLayout()
        filter_grid.setHorizontalSpacing(8)
        filter_grid.setVerticalSpacing(6)
        self.filter_combos: dict[str, QComboBox] = {}
        for index, field_name in enumerate(_FILTER_FIELDS):
            picker = combo()
            picker.setEditable(True)
            picker.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
            picker.setAccessibleName(f"تصفية حسب {FIELD_LABELS[field_name]}")
            picker.lineEdit().setPlaceholderText(FIELD_LABELS[field_name])
            picker.currentTextChanged.connect(self.refresh)
            self.filter_combos[field_name] = picker
            filter_grid.addWidget(picker, index // 3, index % 3)
        layout.addLayout(filter_grid)

        search_row = QHBoxLayout()
        self.search_edit = QLineEdit()
        self.search_edit.setAccessibleName("بحث في المكتبة")
        self.search_edit.setPlaceholderText("بحث في العنوان أو المادة أو الملاحظات…")
        self.search_edit.textChanged.connect(self.refresh)
        self.clear_button = button("مسح الفلاتر")
        self.clear_button.clicked.connect(self._clear_filters)
        search_row.addWidget(self.search_edit, 1)
        search_row.addWidget(self.clear_button)
        layout.addLayout(search_row)

        # --- entries table ------------------------------------------
        self.table = QTableWidget(0, len(COLUMNS))
        self.table.setHorizontalHeaderLabels(COLUMNS)
        self.table.setAccessibleName("جدول إدخالات مكتبة المنهج")
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        header = self.table.horizontalHeader()
        header.setStretchLastSection(False)
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        for column in range(1, len(COLUMNS)):
            header.setSectionResizeMode(column, QHeaderView.ResizeMode.ResizeToContents)
        self.table.itemSelectionChanged.connect(self._update_action_buttons)
        self.table.itemDoubleClicked.connect(lambda _item: self.open_main_file())
        layout.addWidget(self.table, 1)

        # --- actions --------------------------------------------------
        actions = QHBoxLayout()
        self.open_button = button("فتح الملف")
        self.open_button.clicked.connect(self.open_main_file)
        self.folder_button = button("فتح المجلد")
        self.folder_button.clicked.connect(self.open_folder)
        self.edit_button = button("فتح للتعديل")
        self.edit_button.setToolTip(
            "يحمّل السكريبت المحفوظ لهذا الإدخال في المحرر؛ بعد أي تصدير ستُسأل "
            "إن أردت تحديث نفس الإدخال (استبدال) أو إنشاء إدخال جديد."
        )
        self.edit_button.clicked.connect(self.request_edit)
        self.add_button = button("إضافة ملف موجود…")
        self.add_button.setToolTip(
            "لإضافة ما لا تراه Nova Voice (مثل فيديو السبورة المحمّل من المتصفح أو PDF للطباعة)."
        )
        self.add_button.clicked.connect(self.add_existing_file)
        self.video_button = button("تحويل إلى فيديو")
        self.video_button.setToolTip(
            "يسجّل نسخة السبورة المحفوظة لهذا الإدخال (الرسوم والصوت معًا بالتوقيت الأصلي) "
            "داخل النظام دون متصفح خارجي، ويحفظ النتيجة في نفس الإدخال. المدة = مدة الدرس؛ "
            "اترك نافذة التسجيل ظاهرة. أضف بزر «إضافة ملف موجود…» إن كان الفيديو من متصفحك."
        )
        self.video_button.clicked.connect(self.request_video_export)
        self.delete_button = button("حذف")
        self.delete_button.clicked.connect(self.delete_selected)
        self.end_edit_button = button("إنهاء وضع التحرير")
        self.end_edit_button.setToolTip("ينهي ربط التصديرات بالإدخال الحالي دون حذفه أو تعديله.")
        self.end_edit_button.clicked.connect(self.editCancelled.emit)
        actions.addWidget(self.open_button)
        actions.addWidget(self.folder_button)
        actions.addWidget(self.edit_button)
        actions.addWidget(self.add_button)
        actions.addWidget(self.video_button)
        actions.addWidget(self.delete_button)
        actions.addWidget(self.end_edit_button)
        layout.addLayout(actions)

        self.status_label = label("", "muted", True)
        layout.addWidget(self.status_label)
        self.refresh()

    # ------------------------------------------------------------ helpers
    def _filters(self) -> LibraryMetadata:
        return LibraryMetadata.create(
            **{name: combo.currentText() for name, combo in self.filter_combos.items()}
        )

    def _selected_entry_id(self) -> int | None:
        row = self.table.currentRow()
        if row < 0:
            return None
        item = self.table.item(row, 0)
        if item is None:
            return None
        value = item.data(Qt.ItemDataRole.UserRole)
        return int(value) if value is not None else None

    def _update_action_buttons(self) -> None:
        entry_id = self._selected_entry_id()
        selected = entry_id is not None
        for widget in (self.open_button, self.folder_button, self.edit_button, self.delete_button):
            widget.setEnabled(selected)
        exportable = False
        if entry_id is not None:
            try:
                entry = self.library.get(entry_id)
                record = self.library.main_file(entry) if entry is not None else None
                exportable = record is not None and is_exportable_main(record.filename)
            except Exception:
                exportable = False
        self.video_button.setEnabled(exportable)

    # ------------------------------------------------------------- slots
    def refresh(self, *_args) -> None:
        try:
            facets = self.library.facets()
            entries = self.library.list(query=self.search_edit.text(), filters=self._filters())
        except Exception as error:  # DB locked/corrupt must never crash the UI thread
            self.status_label.setText(f"تعذرت قراءة المكتبة: {error}")
            return
        for name, picker in self.filter_combos.items():
            current = picker.currentText()
            picker.blockSignals(True)
            picker.clear()
            picker.addItem("")
            for value in facets[name]:
                picker.addItem(value)
            picker.lineEdit().setText(current)
            picker.blockSignals(False)
        self.table.setRowCount(len(entries))
        for row, entry in enumerate(entries):
            meta = entry.metadata
            values = (
                entry.title,
                KIND_LABELS.get(entry.kind, entry.kind),
                meta.country,
                meta.stage,
                meta.grade,
                meta.academic_year,
                meta.subject,
                meta.term,
                self._format_timestamp(entry.updated_at),
            )
            for column, value in enumerate(values):
                item = QTableWidgetItem(str(value))
                if column == 0:
                    item.setData(Qt.ItemDataRole.UserRole, entry.id)
                self.table.setItem(row, column, item)
        self._update_action_buttons()
        if entries:
            self.status_label.setText(f"{len(entries)} إدخالًا مطابقًا. انقر مرتين لفتح الملف.")
        else:
            self.status_label.setText(
                "لا توجد إدخالات مطابقة بعد. كل توليد مكتمل يُقترح حفظه هنا تلقائيًا، "
                "ويمكنك إضافة أي ملف بزر «إضافة ملف موجود…»."
            )

    def _clear_filters(self) -> None:
        for picker in self.filter_combos.values():
            picker.blockSignals(True)
            picker.setCurrentIndex(0)
            picker.lineEdit().setText("")
            picker.blockSignals(False)
        self.search_edit.blockSignals(True)
        self.search_edit.setText("")
        self.search_edit.blockSignals(False)
        self.refresh()

    @staticmethod
    def _format_timestamp(value: str) -> str:
        try:
            return datetime.fromisoformat(value).strftime("%Y-%m-%d %H:%M")
        except ValueError:
            return value

    def open_main_file(self) -> None:
        entry_id = self._selected_entry_id()
        if entry_id is None:
            return
        entry = self.library.get(entry_id)
        record = self.library.main_file(entry) if entry else None
        if record is None:
            QMessageBox.information(self, "لا يوجد ملف", "هذا الإدخال لا يحتوي ملفًا.")
            return
        path = self.library.entry_file(entry_id, record.filename)
        if not path.is_file():
            QMessageBox.warning(
                self,
                "الملف غير موجود",
                "الملف غير موجود داخل المكتبة. قد تكون حذفته يدويًا؛ احذف الإدخال أو أعد إضافته.",
            )
            return
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(path)))

    def open_folder(self) -> None:
        entry_id = self._selected_entry_id()
        if entry_id is None:
            return
        directory = self.library.entry_dir(entry_id)
        directory.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(directory)))

    def request_edit(self) -> None:
        entry_id = self._selected_entry_id()
        if entry_id is not None:
            self.editRequested.emit(entry_id)

    def request_video_export(self) -> None:
        entry_id = self._selected_entry_id()
        if entry_id is None:
            return
        try:
            entry = self.library.get(entry_id)
            record = self.library.main_file(entry) if entry is not None else None
        except Exception:
            record = None
        if record is None or not is_exportable_main(record.filename):
            QMessageBox.information(
                self,
                "التحويل متاح للسبورة HTML فقط",
                "يحتاج زر «تحويل إلى فيديو» إدخالًا ملفه الرئيسي صفحة HTML سبورة Nova "
                "(تحمل الرسوم والتوقيت). أضف فيديو جاهزًا بزر «إضافة ملف موجود…» بدلًا من ذلك.",
            )
            self._update_action_buttons()
            return
        self.videoExportRequested.emit(entry_id)

    def add_existing_file(self) -> None:
        chosen, _ = QFileDialog.getOpenFileName(
            self,
            "إضافة ملف إلى مكتبة المنهج",
            "",
            "كل الملفات (*);;"
            "HTML (*.html *.htm);;"
            "فيديو (*.mp4 *.webm *.mkv *.mov *.avi);;"
            "صوت (*.mp3 *.wav *.m4a *.aac *.ogg *.flac);;"
            "PDF (*.pdf)",
        )
        if not chosen:
            return
        path = Path(chosen)
        try:
            dialog = LibrarySaveDialog(
                self,
                title=path.stem[:MAX_TITLE_CHARACTERS],
                metadata=LibraryMetadata(),
                library=self.library,
                heading="إضافة ملف موجود إلى المكتبة",
            )
            if dialog.exec() != QDialog.DialogCode.Accepted:
                return
            values = dialog.result_values()
            if not values.title:
                QMessageBox.warning(self, "العنوان مطلوب", "اكتب عنوانًا للإدخال.")
                return
            self.library.add(
                title=values.title,
                kind=kind_for_suffix(path),
                files={"main": path},
                metadata=values.metadata,
                notes=values.notes,
            )
        except LibraryError as error:
            QMessageBox.warning(self, "تعذرت الإضافة", str(error))
            return
        self.refresh()
        self.status_label.setText(f"أُضيف «{values.title}» إلى المكتبة.")

    def delete_selected(self) -> None:
        entry_id = self._selected_entry_id()
        if entry_id is None:
            return
        entry = self.library.get(entry_id)
        title = entry.title if entry else f"#{entry_id}"
        answer = QMessageBox.question(
            self,
            "حذف من المكتبة؟",
            f"سيُحذف الإدخال «{title}» وملفاته المنسوخة داخل المكتبة نهائيًا. "
            "الملفات الأصلية خارج المكتبة لا تُمس. هل أنت متأكد؟",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if answer != QMessageBox.StandardButton.Yes:
            return
        try:
            self.library.delete(entry_id)
        except LibraryError as error:
            QMessageBox.warning(self, "تعذر الحذف", str(error))
            return
        self.entryDeleted.emit(entry_id)
        self.refresh()
        self.status_label.setText(f"حُذف الإدخال «{title}» من المكتبة.")
