"""Native, dependency-free appearance controls for the owned whiteboard template."""

from PySide6.QtCore import Signal
from PySide6.QtGui import QColor, QIcon
from PySide6.QtWidgets import QCheckBox, QColorDialog, QHBoxLayout, QVBoxLayout, QWidget

from .appearance import CHARACTERS, BoardAppearance, RowColor, color_value
from .controls import Disclosure, button, combo, label
from .storage import resource_dir


class AppearancePicker(QWidget):
    sentences_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._first_color = "#2563EB"
        self._second_color = "#C2410C"
        self._row_colors: dict[tuple[int, int], str] = {}
        self._row_speakers: dict[tuple[int, int], int] = {}
        self._fingerprint = ""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(label("ألوان الجمل وشخصيات الأطفال", "section"))
        self.layout_combo = combo()
        self.layout_combo.setAccessibleName("ترتيب اللغتين على السبورة")
        self.layout_combo.addItem("الإنجليزي فوق والعربي تحته", "stacked")
        self.layout_combo.addItem("عمودان: English يسار / العربي يمين", "columns")
        self.layout_combo.addItem("ترتيب السكريبت دون تجميع", "script")
        layout.addWidget(label("ترتيب العربية وEnglish", "muted"))
        layout.addWidget(self.layout_combo)
        self.first_color_button = button("")
        self.second_color_button = button("")
        self.first_color_button.clicked.connect(lambda: self._choose_role_color(1))
        self.second_color_button.clicked.connect(lambda: self._choose_role_color(2))
        colors = QHBoxLayout()
        colors.addWidget(self.first_color_button)
        colors.addWidget(self.second_color_button)
        layout.addLayout(colors)
        characters = QHBoxLayout()
        self.first_character = combo()
        self.second_character = combo()
        for role, picker in ((1, self.first_character), (2, self.second_character)):
            picker.setAccessibleName(f"شخصية الدور {role} على السبورة")
            picker.addItem("بدون شخصية", "none")
            for key, name, kind in CHARACTERS:
                icon = QIcon(str(resource_dir() / "assets" / "characters" / f"{key}.svg"))
                title = f"{name} · {'ولد' if kind == 'boy' else 'بنت'}"
                picker.addItem(icon, title, key)
            column = QVBoxLayout()
            column.addWidget(label(f"شخصية الدور {role}", "muted"))
            column.addWidget(picker)
            characters.addLayout(column)
        layout.addLayout(characters)
        self.animate = QCheckBox("تحريك الشخصيات أثناء التشغيل فقط")
        self.animate.setChecked(True)
        layout.addWidget(self.animate)
        self.sentence_section = Disclosure("تخصيص متقدم · لون جملة بعينها")
        sentence_layout = self.sentence_section.content_layout
        row_actions = QHBoxLayout()
        self.refresh_sentences = button("تحديث قائمة الجمل")
        self.refresh_sentences.clicked.connect(self.sentences_requested.emit)
        self.sentence_combo = combo()
        self.sentence_combo.setAccessibleName("الجملة المطلوب تخصيص لونها")
        self.sentence_combo.currentIndexChanged.connect(self._sentence_selection_changed)
        self.sentence_color_button = button("لون الجملة المختارة")
        self.sentence_color_button.clicked.connect(self._choose_sentence_color)
        self.clear_sentence_button = button("لون الدور الافتراضي")
        self.clear_sentence_button.clicked.connect(self._clear_sentence_color)
        row_actions.addWidget(self.refresh_sentences)
        row_actions.addWidget(self.sentence_combo, 1)
        sentence_layout.addLayout(row_actions)
        color_actions = QHBoxLayout()
        color_actions.addWidget(self.sentence_color_button)
        color_actions.addWidget(self.clear_sentence_button)
        sentence_layout.addLayout(color_actions)
        layout.addWidget(self.sentence_section)
        self.hint = label(
            "جهّز السكريبت ثم حدّث قائمة الجمل. التخصيص يظهر بالتوليد الموحّد أو بعد إعادة الخطوة 1. "
            "يمكن أيضًا تعديل الألوان والشخصيات وحفظ نسخة من داخل HTML. "
            "الشخصيات للعرض فقط، ولا تغيّر الصوت أو لغته.",
            "muted",
            True,
        )
        layout.addWidget(self.hint)
        self._refresh_colors()
        self.invalidate_rows()

    def _refresh_colors(self) -> None:
        for role, color, widget in (
            (1, self._first_color, self.first_color_button),
            (2, self._second_color, self.second_color_button),
        ):
            widget.setText(f"لون الدور {role} · {color}")
            widget.setStyleSheet(f"border-left:8px solid {color};")

    def _choose_role_color(self, role: int) -> None:
        current = self._first_color if role == 1 else self._second_color
        selected = QColorDialog.getColor(QColor(current), self, f"لون جمل الدور {role}")
        if not selected.isValid():
            return
        if role == 1:
            self._first_color = color_value(selected.name())
        else:
            self._second_color = color_value(selected.name())
        self._refresh_colors()

    def _choose_sentence_color(self) -> None:
        key = self.sentence_combo.currentData()
        if key is None:
            return
        key = tuple(key)
        base = self._second_color if self._row_speakers.get(key) == 2 else self._first_color
        current = self._row_colors.get(key, base)
        selected = QColorDialog.getColor(QColor(current), self, "لون الجملة المختارة")
        if selected.isValid():
            self._row_colors[key] = color_value(selected.name())
            self.sentence_color_button.setStyleSheet(f"border-left:8px solid {selected.name()};")

    def _clear_sentence_color(self) -> None:
        key = self.sentence_combo.currentData()
        if key is not None:
            self._row_colors.pop(tuple(key), None)
        self.sentence_color_button.setStyleSheet("")

    def _sentence_selection_changed(self, *_args) -> None:
        if not hasattr(self, "sentence_color_button"):
            return
        key = self.sentence_combo.currentData()
        color = self._row_colors.get(tuple(key)) if key is not None else None
        self.sentence_color_button.setStyleSheet(f"border-left:8px solid {color};" if color else "")

    def invalidate_rows(self) -> None:
        if self._row_colors:
            self.hint.setText(
                "تغيّر السكريبت أو وضع الحوار؛ أُزيلت ألوان الجمل القديمة حتى لا تُطبّق على نص آخر. "
                "الألوان العامة والشخصيات باقية. حدّث قائمة الجمل قبل تخصيصها مجددًا."
            )
        self._fingerprint = ""
        self._row_colors.clear()
        self._row_speakers.clear()
        self.sentence_combo.clear()
        self.sentence_combo.addItem("حدّث قائمة الجمل بعد إعداد السكريبت", None)
        self.sentence_color_button.setEnabled(False)
        self.clear_sentence_button.setEnabled(False)
        self.sentence_color_button.setStyleSheet("")

    def set_rows(self, lesson) -> None:
        fingerprint = lesson.manifest()["fingerprint"]
        if self._fingerprint != fingerprint:
            self._row_colors.clear()
        self._fingerprint = fingerprint
        self._row_speakers.clear()
        self.sentence_combo.clear()
        for step_index, step in enumerate(lesson.steps):
            for row_index, row in enumerate(step.rows):
                self._row_speakers[(step_index, row_index)] = row.speaker
                self.sentence_combo.addItem(
                    f"{step_index + 1}.{row_index + 1} · {row.text[:60]}",
                    (step_index, row_index),
                )
        self.sentence_color_button.setEnabled(True)
        self.clear_sentence_button.setEnabled(True)

    def snapshot(self, lesson) -> BoardAppearance:
        matching = self._fingerprint == lesson.manifest()["fingerprint"]
        rows = (
            tuple(
                RowColor(step, row, color)
                for (step, row), color in sorted(self._row_colors.items())
            )
            if matching
            else ()
        )
        return BoardAppearance(
            self._first_color,
            self._second_color,
            self.first_character.currentData(),
            self.second_character.currentData(),
            self.animate.isChecked(),
            rows,
            self.layout_combo.currentData(),
        ).validated(tuple(len(step.rows) for step in lesson.steps))

    def restore(self, appearance: BoardAppearance, lesson) -> None:
        self._first_color = appearance.first_color
        self._second_color = appearance.second_color
        self.first_character.setCurrentIndex(
            self.first_character.findData(appearance.first_character)
        )
        self.second_character.setCurrentIndex(
            self.second_character.findData(appearance.second_character)
        )
        self.animate.setChecked(appearance.animate_characters)
        self.layout_combo.setCurrentIndex(self.layout_combo.findData(appearance.layout))
        self.set_rows(lesson)
        self._row_colors = {(item.step, item.row): item.color for item in appearance.row_colors}
        self._refresh_colors()
        self._sentence_selection_changed()
