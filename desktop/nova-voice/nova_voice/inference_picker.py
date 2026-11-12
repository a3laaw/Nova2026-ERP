"""Native sixth tab for the offline guide. No editor/adoption/provider signals."""

import json
import tempfile
from collections.abc import Callable
from pathlib import Path

from PySide6.QtCore import QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QApplication,
    QFileDialog,
    QGridLayout,
    QHBoxLayout,
    QLineEdit,
    QMessageBox,
    QPlainTextEdit,
    QVBoxLayout,
    QWidget,
)

from .controls import Disclosure, button, combo, label
from .inference import (
    GuideFields,
    InferenceError,
    build_drawing,
    build_prompt,
    capability,
    load_catalog,
    search_catalog,
)
from .storage import resource_dir


class InferencePicker(QWidget):
    def __init__(self, policy_provider: Callable[[], str], parent=None):
        super().__init__(parent)
        self.setObjectName("inference")
        self.policy_provider = policy_provider
        self.catalog = load_catalog()
        self._built = ""
        self._built_policy = ""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 16, 8, 8)
        layout.setSpacing(12)
        layout.addWidget(label("استدلال · دليل كل إمكانات البرنامج", "section"))
        layout.addWidget(
            label(
                "اختر القدرة: ما الذي تطلبه، وما شكل الناتج، وأين تستخدمه؟ "
                "الدليل محلي ولا يقرأ PDF أو يستدعي نموذجًا أو ينقل نصًا للمحرر. "
                "المادة والصف نص حر، بما فيه الإعدادي، دون قوالب مواد ثابتة.",
                "muted",
                True,
            )
        )
        filters = QHBoxLayout()
        self.search = QLineEdit()
        self.search.setFixedHeight(40)
        self.search.setPlaceholderText("ابحث: حوار، PDF، حركة، path، طباعة…")
        self.search.setAccessibleName("البحث في قدرات استدلال")
        filters.addWidget(self.search, 2)
        self.category = combo()
        self.category.setAccessibleName("قسم القدرات")
        self.category.addItem("كل الأقسام", "all")
        for item in self.catalog["categories"]:
            self.category.addItem(item["title"], item["id"])
        filters.addWidget(self.category, 1)
        self.mode = combo()
        self.mode.setAccessibleName("نوع استخدام القدرة")
        for title, value in (("الكل", "all"), ("يحتاج طلبًا", "prompt"), ("إعداد محلي", "local")):
            self.mode.addItem(title, value)
        filters.addWidget(self.mode, 1)
        layout.addLayout(filters)
        self.features = combo()
        self.features.setAccessibleName("القدرة أو المسار المطلوب")
        layout.addWidget(self.features)
        self.matches = label("", "muted")
        layout.addWidget(self.matches)
        self.details = QPlainTextEdit()
        self.details.setReadOnly(True)
        self.details.setAccessibleName("شرح القدرة ومكان استخدامها وحدودها")
        self.details.setMinimumHeight(190)
        self.details.setMaximumHeight(280)
        layout.addWidget(self.details)
        self.example_section = Disclosure("مثال مؤلف وشكل الناتج · ليس نص الوزارة أو نتيجة AI")
        self.example = QPlainTextEdit()
        self.example.setReadOnly(True)
        self.example.setAccessibleName("المصدر المؤلف والناتج المتوافق")
        self.example.setMinimumHeight(130)
        self.example.setMaximumHeight(230)
        self.example_section.content_layout.addWidget(self.example)
        layout.addWidget(self.example_section)
        self.policy_note = label("", "setup", True)
        layout.addWidget(self.policy_note)

        self.form = QWidget()
        form = QVBoxLayout(self.form)
        form.setContentsMargins(0, 0, 0, 0)
        fields = QGridLayout()
        self.subject, self.grade, self.title = QLineEdit(), QLineEdit(), QLineEdit()
        for column, (widget, name, hint) in enumerate(
            (
                (self.subject, "المادة · اختياري حتى 80 حرفًا", "علوم، هندسة، جغرافيا…"),
                (self.grade, "الصف/العمر · اختياري حتى 80 حرفًا", "مثل: الأول الإعدادي"),
                (self.title, "عنوان الدرس · اختياري حتى 120 حرفًا", "العنوان المناسب للمصدر"),
            )
        ):
            widget.setAccessibleName(name)
            widget.setPlaceholderText(hint)
            widget.setFixedHeight(40)
            fields.addWidget(label(name, "muted"), 0, column)
            fields.addWidget(widget, 1, column)
        form.addLayout(fields)
        form.addWidget(label("نص مصدر مستخرج ومراجع · ليس رفع PDF أو صورة", "section"))
        self.source = QPlainTextEdit()
        self.source.setAccessibleName("النص المصدر في استدلال، لا ينتقل للمحرر تلقائيًا")
        self.source.setPlaceholderText(
            "ألصق النص المراجع هنا، بلا بيانات طلاب أو مفاتيح. "
            "راجع المصطلحات والأرقام والمعادلات، واذكر موضع الجزء الناقص دون تخمينه."
        )
        self.source.setMinimumHeight(120)
        self.source.setMaximumHeight(210)
        form.addWidget(self.source)
        source_actions = QHBoxLayout()
        self.counter = label("0 / 12000 حرف · قسّم الطويل؛ لا يُقص تلقائيًا.", "muted")
        source_actions.addWidget(self.counter, 1)
        self.example_button = button("استخدم المثال المؤلف للتجربة")
        self.example_button.clicked.connect(self._load_example)
        source_actions.addWidget(self.example_button)
        form.addLayout(source_actions)
        self.notes_section = Disclosure("متطلبات إضافية للشرح · اختياري حتى 2000 حرف")
        self.notes = QPlainTextEdit()
        self.notes.setAccessibleName("متطلبات إضافية للشرح، ليست إعدادات تشغيل")
        self.notes.setMinimumHeight(80)
        self.notes.setMaximumHeight(150)
        self.notes_section.content_layout.addWidget(self.notes)
        form.addWidget(self.notes_section)
        layout.addWidget(self.form)
        actions = QHBoxLayout()
        self.build_button = button("بناء الطلب", "primary")
        self.build_button.clicked.connect(self._build)
        self.copy_button = button("نسخ الطلب")
        self.copy_button.clicked.connect(self._copy)
        self.save_button = button("حفظ TXT")
        self.save_button.clicked.connect(self._save)
        self.drawing_button = button("نسخ متطلبات الرسم المنفصلة")
        self.drawing_button.clicked.connect(self._copy_drawing)
        for widget in (self.build_button, self.copy_button, self.save_button, self.drawing_button):
            actions.addWidget(widget)
        layout.addLayout(actions)
        self.state = label("", "muted", True)
        self.state.setAccessibleName("حالة بناء طلب استدلال")
        layout.addWidget(self.state)
        self.output = QPlainTextEdit()
        self.output.setReadOnly(True)
        self.output.setAccessibleName("الطلب أو الخطوات المحلية الجاهزة للنسخ")
        self.output.setPlaceholderText("لا يُبنى طلب قبل ضغطك. تغيير الحقول يلغي النص المبني.")
        self.output.setMinimumHeight(160)
        self.output.setMaximumHeight(300)
        layout.addWidget(self.output)
        self.open_guide_button = button("فتح استدلال الكامل في المتصفح · دون إنترنت")
        self.open_guide_button.clicked.connect(self._open_guide)
        layout.addWidget(self.open_guide_button)
        layout.addWidget(
            label(
                "إسقاط كروي2.5D مبسط، لا محرك3D عام أو PDF/OCR أو محاكاة أو مزامنة شفاه. "
                "لا اعتماد منهج/خرائط/قرآن. "
                "الأمثلة مؤلفة، ولا استدلال حي أو Windows/4GB أو جودة صوت بشري مثبتة هنا. "
                "النسخ الخارجي قرارك؛ لا حفظ حقول أو مفاتيح أو إرسال من الدليل.",
                "muted",
                True,
            )
        )
        for edit in (self.source, self.notes):
            edit.textChanged.connect(self._invalidate)
        for edit in (self.subject, self.grade, self.title):
            edit.textChanged.connect(self._invalidate)
        self.search.textChanged.connect(self._filter)
        self.category.currentIndexChanged.connect(self._filter)
        self.mode.currentIndexChanged.connect(self._filter)
        self.features.currentIndexChanged.connect(self._select)
        self._filter()

    def _fields(self) -> GuideFields:
        return GuideFields(
            self.subject.text(),
            self.grade.text(),
            self.title.text(),
            self.source.toPlainText(),
            self.notes.toPlainText(),
        )

    def _invalidate(self, *_):
        self._built = ""
        self.output.clear()
        self.copy_button.setEnabled(False)
        self.save_button.setEnabled(False)
        self.counter.setText(
            f"{len(self.source.toPlainText())} / 12000 حرف · قسّم الطويل؛ لا يُقص تلقائيًا."
        )
        self.state.setText("أعد البناء بعد التعديل. لا إرسال أو حفظ أو نقل للمحرر.")

    def _filter(self, *_):
        previous = self.features.currentData()
        entries = search_catalog(
            self.catalog,
            self.search.text(),
            category=self.category.currentData(),
            mode=self.mode.currentData(),
        )
        self.features.blockSignals(True)
        self.features.clear()
        for entry in entries:
            self.features.addItem(entry["title"], entry["id"])
        index = self.features.findData(previous)
        if index >= 0:
            self.features.setCurrentIndex(index)
        self.features.blockSignals(False)
        self.matches.setText(f"{len(entries)} من {len(self.catalog['entries'])} قدرة ومسار")
        self._select()

    def _select(self, *_):
        self._invalidate()
        identifier = self.features.currentData()
        selected = identifier is not None
        sacred = self.policy_provider() == "sacred"
        self.build_button.setEnabled(selected)
        self.drawing_button.setEnabled(False)
        self.example_section.setVisible(selected and not sacred)
        self.form.hide()
        self.details.clear()
        self.example.clear()
        if not selected:
            self.details.setPlainText("لا نتائج؛ غيّر البحث أو الفلاتر. حقولك لم تُحذف.")
            return
        entry = capability(self.catalog, identifier)
        local = entry["kind"] == "local" or sacred
        self.form.setVisible(not local)
        self.build_button.setText("عرض الخطوات المحلية" if local else "بناء الطلب")
        self.copy_button.setText("نسخ الخطوات" if local else "نسخ الطلب")
        self.policy_note.setText(
            "سياسة البرنامج: نصوص مقدسة. لا طلب خارجي أو نص مصدر في النسخ؛ مراجعة محلية فقط."
            if sacred
            else "سياسة البرنامج: محتوى عام. الطلب لا يختار صوتًا أو لونًا أو يطبع/يصدّر. "
            "للرسم انسخ ملحق المتطلبات إلى توجيه البرنامج المرتبط بالمصدر، لا إلى النطق."
        )
        if sacred:
            self.details.setPlainText(self.catalog["shared"]["sacred"])
            return
        self.details.setPlainText(
            "\n\n".join(
                (
                    entry["title"] + "\n" + entry["summary"],
                    "المكان: " + self.catalog["targets"][entry["target"]],
                    "\n".join(f"{i}. {step}" for i, step in enumerate(entry["steps"], 1)),
                    "الناتج: " + entry["result"],
                    "الحدود:\n" + "\n".join("• " + value for value in entry["limits"]),
                )
            )
        )
        example = (
            "مصدر مؤلف:\n"
            + entry["example"]["source"]
            + "\n\nالناتج:\n"
            + entry["example"]["output"]
        )
        if entry["element"] is not None:
            example += "\n\nعنصر مؤلف فقط، وليس خطة JSON:\n" + json.dumps(
                entry["element"], ensure_ascii=False, indent=2
            )
        self.example.setPlainText(example)
        self.drawing_button.setEnabled(bool(entry["drawing"]))

    def refresh_policy(self, *_):
        self._select()  # Invalidate prior copies even if the user changes back.

    def _error(self, error):
        self.state.setText(str(error))

    def _build(self):
        self._invalidate()
        try:
            self._built_policy = self.policy_provider()
            self._built = build_prompt(
                self.features.currentData(),
                self._fields(),
                policy=self._built_policy,
                catalog=self.catalog,
            )
            self.output.setPlainText(self._built)
            self.copy_button.setEnabled(True)
            self.save_button.setEnabled(True)
            self.state.setText(
                "جاهز للنسخ والمراجعة فقط. لم يتغير المحرر أو الصوت أو اعتماد الرسوم."
            )
        except InferenceError as error:
            self._error(error)

    def _fresh(self) -> str:
        if (
            not self._built
            or self._built_policy != self.policy_provider()
            or self._built != self.output.toPlainText()
            or self._built
            != build_prompt(
                self.features.currentData(),
                self._fields(),
                policy=self.policy_provider(),
                catalog=self.catalog,
            )
        ):
            raise InferenceError("أعد البناء بعد أي تعديل أو تغيير سياسة قبل النسخ أو الحفظ.")
        return self._built

    def _copy(self):
        try:
            QApplication.clipboard().setText(self._fresh())
            self.state.setText("نُسخ النص للحافظة فقط، بلا إرسال أو نقل للمحرر.")
        except InferenceError as error:
            self._error(error)

    def _copy_drawing(self):
        try:
            text = build_drawing(
                self.features.currentData(), policy=self.policy_provider(), catalog=self.catalog
            )
            QApplication.clipboard().setText(text)
            self.state.setText(
                "نُسخ ملحق الرسم فقط. ألحقه بتوجيه «مشاهد ذكية» المرتبط بالمصدر؛ ليس خطة JSON."
            )
        except InferenceError as error:
            self._error(error)

    def _save(self):
        try:
            text = self._fresh()
            name, _ = QFileDialog.getSaveFileName(
                self, "حفظ طلب استدلال أو خطواته", "NovaVoice-Istidlal.txt", "Text (*.txt)"
            )
            if not name:
                return
            path = Path(name)
            if path.suffix.lower() != ".txt":
                path = Path(str(path) + ".txt")
                if (
                    path.exists()
                    and QMessageBox.question(
                        self,
                        "استبدال TXT موجود؟",
                        "الاسم بعد إضافة .txt موجود. هل تريد استبداله؟",
                        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                        QMessageBox.StandardButton.No,
                    )
                    != QMessageBox.StandardButton.Yes
                ):
                    return
            # Modal dialogs can re-enter the event loop; check policy/fields again.
            if text != self._fresh():
                return
            with tempfile.TemporaryDirectory(prefix=".nova-guide-", dir=path.parent) as directory:
                temporary = Path(directory) / "request.txt"
                temporary.write_text(text, encoding="utf-8")
                temporary.replace(path)
            self.state.setText("حُفظ TXT بطلبك، وليس درسًا أو خطة JSON معتمدة.")
        except (OSError, InferenceError) as error:
            self._error(
                error if isinstance(error, InferenceError) else InferenceError("تعذّر حفظ ملف TXT.")
            )

    def _load_example(self):
        if self.policy_provider() != "general" or self.features.currentData() is None:
            return
        entry = capability(self.catalog, self.features.currentData())
        if entry["kind"] == "local":
            return
        if (
            self.source.toPlainText().strip()
            and QMessageBox.question(
                self,
                "استبدال حقل المصدر بالمثال المؤلف؟",
                "سيُستبدل حقل المصدر في استدلال فقط، لا محرر السكريبت. هل تريد المتابعة؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        self.source.setPlainText(entry["example"]["source"])

    def _open_guide(self):
        path = resource_dir() / "INFERENCE-GUIDE-AR.html"
        if not path.is_file() or not QDesktopServices.openUrl(QUrl.fromLocalFile(str(path))):
            self.state.setText("تعذّر فتح الدليل. افتح INFERENCE-GUIDE-AR.html من الحزمة الكاملة.")
