"""Full-lesson authoring is separate from the original script and visual-plan editor."""

import tempfile
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from PySide6.QtCore import Qt, QUrl, Signal
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QFileDialog,
    QHBoxLayout,
    QLineEdit,
    QMessageBox,
    QPlainTextEdit,
    QVBoxLayout,
    QWidget,
)

from .controls import Disclosure, button, combo, label
from .lesson_brief import LessonBrief
from .lesson_draft import LessonDraft
from .lesson_planner import manual_prompt
from .storage import resource_dir
from .text import ScriptError
from .whiteboard import save_whiteboard


@dataclass(frozen=True)
class LessonRequest:
    brief: LessonBrief = field(repr=False)
    key: str = field(repr=False)
    consent: bool = False
    adult: bool = False
    secondary_assets: bool = False
    provider: str = "openrouter"


OPENROUTER_DISCLOSURE = (
    "يُرسل الوصف والمادة والصف فقط إلى OpenRouter ومزوّد النموذج، لا نص الم"
    "حرر القديم أو صوت أو صور. للمُعدّ البالغ 18+ بحساب مؤهل وموافقة جديدة "
    "لكل طلب، بلا بيانات طلاب أو معلومات حساسة. openrouter/free بسعر صفر وم"
    "رشحات منع جمع البيانات وZDR، بلا إعادة محاولة أو شراء رصيد أو بديل مدف"
    "وع. قد لا يتوفر مزود يوافقها؛ المجانية والحصص والأهلية غير مضمونة. راج"
    "ع openrouter.ai/terms وopenrouter.ai/privacy وشروط المزوّد. لم يُختبر "
    "استدلال حي هنا؛ الإلغاء قد ينتظر مهلة الشبكة."
)

GEMINI_DISCLOSURE = (
    "يُرسل الوصف والمادة والصف فقط إلى Google AI Studio (Gemini)، لا نص الم"
    "حرر القديم أو صوت أو صور. للمُعدّ البالغ 18+ بحساب مؤهل وموافقة جديدة "
    "لكل طلب، بلا بيانات طلاب أو معلومات حساسة. gemini-2.5-flash فقط داخل "
    "حصة AI Studio المجانية؛ بلا فوترة وبلا أي مسار مدفوع، والتوقف عند نفاد "
    "الحصة دون ترقية. تنبيه: طبقة Google المجانية قد تستخدم الطلبات والردود "
    "لتحسين منتجات Google ويطّلع عليها مُراجِعون بشريون؛ لا ترسل نصوصًا مقدسة "
    "أو شخصية أو طلابية. الحصص والشروط تتغير؛ راجع ai.google.dev/gemini-api/terms "
    "وaistudio.google.com. لم يُختبر استدلال حي هنا؛ الإلغاء قد ينتظر مهلة الشبكة."
)

PROVIDER_LABELS = {
    "openrouter": "OpenRouter · مجاني مع منع التدريب/الاحتفاظ",
    "gemini": "Google Gemini · مجاني؛ قد يستخدمه Google للتحسين",
}


class LessonPicker(QWidget):
    changed = Signal()
    requested = Signal(object)
    adopted = Signal(object)
    detached = Signal()

    def __init__(self, policy_provider: Callable[[], str], parent=None):
        super().__init__(parent)
        self.policy_provider = policy_provider
        self.revision = 0
        self._preview_dir = tempfile.TemporaryDirectory(prefix="nova-full-lesson-review-")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(
            label(
                (
                    "اكتب وصفًا قصيرًا لا سكريبتًا كاملًا. المسودة تضيف أهدافًا ومراحل شرح "
                    "ورسومًا وأسئلة وإجابات وخلاصة؛ لا قوالب مواد ثابتة. لا تُنقل للمحرر ول"
                    "ا تُنطق قبل مراجعتك. وضع النصوص المقدسة لا يسمح بهذا التوسيع."
                ),
                "muted",
                True,
            )
        )
        self.brief_edit = QPlainTextEdit()
        self.brief_edit.setAccessibleName("الوصف الأصلي لتوليد درس كامل — حتى 4000 حرف")
        self.brief_edit.setPlaceholderText(
            "مثال: اشرح دورة المياه لطلاب الإعدادي، برسوم للشمس والبحر والسحب وأسهم المراحل."
        )
        self.brief_edit.setMinimumHeight(90)
        self.brief_edit.setMaximumHeight(160)
        layout.addWidget(self.brief_edit)
        hints = QHBoxLayout()
        self.subject = QLineEdit()
        self.subject.setMaxLength(80)
        self.subject.setPlaceholderText("المادة · اختياري")
        self.subject.setAccessibleName("مادة الدرس الكامل، لا قالب رسم")
        self.grade = QLineEdit()
        self.grade.setMaxLength(80)
        self.grade.setPlaceholderText("الصف/العمر · اختياري")
        self.grade.setAccessibleName("صف أو عمر الدرس الكامل، بما فيه الإعدادي")
        hints.addWidget(self.subject)
        hints.addWidget(self.grade)
        layout.addLayout(hints)
        self.allow_assets = QCheckBox("اقتراح موارد مجانية ثانوية من الوصف · لا تنزيل تلقائي")
        layout.addWidget(self.allow_assets)
        layout.addWidget(
            label(
                "الاختيار من معنى الوصف لا من قائمة يختارها المعلم. الموارد صور ظلية مدققة "
                "ولها بدائل أصلية. بعد مراجعة الدرس ونقله للمحرر، جهّز موارد خطة المشاهد "
                "من القسم التالي محليًا أو بإذن تنزيل منفصل، ثم راجع واعتمد الخطة من جديد.",
                "muted",
                True,
            )
        )
        actions = QHBoxLayout()
        for name, title, handler in (
            ("import_button", "استيراد مسودة JSON", self._import),
            ("prompt_button", "نسخ توجيه للدرس الكامل", self._copy_prompt),
            ("example_button", "مثال درس كامل محلي · ليس API", self._example),
        ):
            widget = button(title)
            widget.clicked.connect(handler)
            setattr(self, name, widget)
            actions.addWidget(widget)
        layout.addLayout(actions)
        cloud = Disclosure("وصف ← درس كامل ورسوم · طلب شبكي اختياري واحد")
        self.cloud_section = cloud
        self.provider = combo()
        self.provider.addItem(PROVIDER_LABELS["openrouter"], "openrouter")
        self.provider.addItem(PROVIDER_LABELS["gemini"], "gemini")
        self.provider.setAccessibleName("مزود اقتراح الدرس الكامل المجاني")
        self.provider.currentIndexChanged.connect(self._provider_changed)
        cloud.content_layout.addWidget(self.provider)
        self.cloud_notice = label(OPENROUTER_DISCLOSURE, "muted", True)
        cloud.content_layout.addWidget(self.cloud_notice)
        self.key = QLineEdit()
        self.key.setEchoMode(QLineEdit.EchoMode.Password)
        self.key.setMaxLength(512)
        self.key.setPlaceholderText("مفتاح خاص لهذا الطلب فقط — لا يُحفظ ولا يُكتب في المحادثة")
        self.key.setAccessibleName("مفتاح OpenRouter السري لطلب الدرس الكامل")
        self.key.setInputMethodHints(
            Qt.InputMethodHint.ImhSensitiveData | Qt.InputMethodHint.ImhNoPredictiveText
        )
        cloud.content_layout.addWidget(self.key)
        self.adult = QCheckBox("أنا مُعدّ بالغ 18+ وأقر أهلية الحساب وشروط المزود")
        self.consent = QCheckBox("أوافق على إرسال هذا الوصف الآن، بلا بيانات شخصية أو حساسة")
        cloud.content_layout.addWidget(self.adult)
        cloud.content_layout.addWidget(self.consent)
        self.request_button = button("اقتراح درس كامل مرسوم · مجاني فقط", "primary")
        self.request_button.clicked.connect(self._request)
        cloud.content_layout.addWidget(self.request_button)
        layout.addWidget(cloud)
        layout.addWidget(
            label(
                "رد JSON قابل للتعديل: تُعاد بصمته محليًا بعد التحقق، وأي تعديل يحتاج اعتمادًا جديدًا. "
                "الحزمة المحفوظة تحتفظ بالوصف والبصمات؛ لا تحذف بصماتها لتجاوز فحصها.",
                "muted",
                True,
            )
        )
        self.draft_edit = QPlainTextEdit()
        self.draft_edit.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        self.draft_edit.setAccessibleName("JSON مسودة الدرس الكامل القابلة للتعديل")
        self.draft_edit.setPlaceholderText(
            "استورد حزمة، أو الصق رد JSON للتوجيه، أو اطلب مسودة. التعديل يلغي الارتباط المعتمد."
        )
        self.draft_edit.setMinimumHeight(180)
        self.draft_edit.setMaximumHeight(300)
        layout.addWidget(self.draft_edit)
        controls = QHBoxLayout()
        for title, handler in (
            ("مراجعة الأصل والدرس والإجابات", self._review),
            ("معاينة مسودة بلا صوت", self._preview),
            ("حفظ حزمة المسودة", self._export),
        ):
            widget = button(title)
            widget.clicked.connect(handler)
            controls.addWidget(widget)
        layout.addLayout(controls)
        self.review = QPlainTextEdit()
        self.review.setReadOnly(True)
        self.review.setAccessibleName("مراجعة الوصف الحرفي والنص الموسع والعرض والنطق والرسوم")
        self.review.setMinimumHeight(150)
        self.review.setMaximumHeight(280)
        layout.addWidget(self.review)
        adopt = button("راجعت المسودة · نقلها للمحرر للمراجعة النهائية", "primary")
        adopt.clicked.connect(self._adopt)
        layout.addWidget(adopt)
        self.detach_button = button("فصل ارتباط الدرس بالمسودة · تأكيد صريح")
        self.detach_button.clicked.connect(lambda: self.detached.emit())
        layout.addWidget(self.detach_button)
        self.state = label(
            "اختياري. الوصف منفصل عن السكريبت؛ لا تغيير تلقائي لنصك أو أصواتك.", "muted", True
        )
        layout.addWidget(self.state)
        for signal in (
            self.brief_edit.textChanged,
            self.subject.textChanged,
            self.grade.textChanged,
            self.draft_edit.textChanged,
        ):
            signal.connect(self.invalidate)
        self.key.textChanged.connect(self._reset_consent)
        self.allow_assets.toggled.connect(self.invalidate)

    def _provider_changed(self, *_):
        provider = self.provider.currentData() or "openrouter"
        self.cloud_notice.setText(
            OPENROUTER_DISCLOSURE if provider == "openrouter" else GEMINI_DISCLOSURE
        )
        if provider == "openrouter":
            placeholder = "مفتاح خاص لهذا الطلب فقط — لا يُحفظ ولا يُكتب في المحادثة"
            accessible = "مفتاح OpenRouter السري لطلب الدرس الكامل"
        else:
            placeholder = "مفتاح Google AI Studio — لا يُحفظ ولا يُكتب في المحادثة"
            accessible = "مفتاح Google AI Studio السري لطلب الدرس الكامل"
        self.key.setPlaceholderText(placeholder)
        self.key.setAccessibleName(accessible)
        self.key.clear()
        self._reset_consent()
        self.changed.emit()

    def _current_provider(self) -> str:
        return self.provider.currentData() or "openrouter"

    def _reset_consent(self, *_):
        self.consent.setChecked(False)

    def invalidate(self, *_):
        self.revision += 1
        self._reset_consent()
        self.review.clear()
        self.state.setText(
            "مسودة تحتاج مراجعة؛ أي تعديل للوصف/المادة/الصف/JSON يلغي ارتباطها المعتمد."
        )
        self.changed.emit()

    def brief(self):
        return LessonBrief.create(
            self.brief_edit.toPlainText(),
            self.subject.text(),
            self.grade.text(),
            self.policy_provider(),
        )

    def current(self):
        return LessonDraft.from_json(self.draft_edit.toPlainText(), self.brief())

    def _error(self, error):
        QMessageBox.warning(self, "راجع مسودة الدرس الكامل", str(error))

    def set_draft(self, draft: LessonDraft):
        if draft.brief != self.brief():
            raise ScriptError("وصلت مسودة لوصف مختلف؛ أعد الطلب أو استورد الوصف صراحة.")
        # Validate an imported immutable bundle first; expose only its raw content
        # for deliberate editing and local canonical recomputation, never optional hashes.
        draft = LessonDraft.from_data(draft.to_data(), self.brief())
        self.invalidate()  # Even an identical reimport must not inherit adoption.
        self.draft_edit.setPlainText(draft.response_json())
        self._review()
        self.state.setText("وصلت مسودة كاملة، لم يتغير المحرر ولم يبدأ صوت أو تصدير. راجعها أولًا.")

    def _copy_prompt(self):
        try:
            QApplication.clipboard().setText(
                manual_prompt(self.brief(), secondary_assets=self.allow_assets.isChecked())
            )
            self.state.setText(
                "نُسخ التوجيه والوصف للحافظة فقط؛ لا إرسال. راجع شروط الخدمة التي تختار لصقه فيها."
            )
        except ScriptError as error:
            self._error(error)

    def _review(self):
        try:
            self.review.setPlainText(self.current().review_text())
        except ScriptError as error:
            self._error(error)

    def _preview(self):
        try:
            path = Path(self._preview_dir.name) / "Nova-full-DRAFT.html"
            save_whiteboard(self.current().compile(), path)
            if not QDesktopServices.openUrl(QUrl.fromLocalFile(str(path))):
                raise ScriptError("تعذّر فتح المتصفح؛ لم تعتمد المسودة أو يبدأ الصوت.")
            self.state.setText(
                "معاينة مسودة مؤقتة بلا صوت؛ ليست اعتمادًا ولا نتيجة اختبار جودة الخدمة."
            )
        except (OSError, ScriptError) as error:
            self._error(error)

    def _adopt(self):
        try:
            draft = self.current()
            self.review.setPlainText(draft.review_text())
            self.adopted.emit(draft)
        except ScriptError as error:
            self._error(error)

    def _import(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "استيراد حزمة درس أو رد JSON للوصف الحالي", "", "JSON (*.json)"
        )
        if not path:
            return
        try:
            if self.brief_edit.toPlainText().strip():
                self.set_draft(LessonDraft.load(Path(path), self.brief()))
            else:
                draft = LessonDraft.load(Path(path))
                if (
                    QMessageBox.question(
                        self,
                        "استيراد الوصف والمسودة",
                        "سيُملأ الوصف المحفوظ والدرس كمسودة غير معتمدة، ولن يتغير المحرر. هل تتابع؟",
                        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                        QMessageBox.StandardButton.No,
                    )
                    == QMessageBox.StandardButton.Yes
                ):
                    self._fill(draft)
        except (OSError, UnicodeError, ScriptError) as error:
            self._error(error)

    def _fill(self, draft):
        brief = draft.brief.to_data()
        LessonBrief.create(brief["text"], brief["subject"], brief["grade"], self.policy_provider())
        self.brief_edit.setPlainText(brief["text"])
        self.subject.setText(brief["subject"])
        self.grade.setText(brief["grade"])
        self.set_draft(draft)

    def _example(self):
        if (
            self.brief_edit.toPlainText().strip()
            and QMessageBox.question(
                self,
                "مثال محلي فقط",
                (
                    "سيُستبدل الوصف ومسودة JSON فقط بمثال محلي، لا نتيجة API، "
                    "ولن يتغير السكريبت قبل موافقتك. هل تتابع؟"
                ),
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        try:
            self._fill(LessonDraft.load(resource_dir() / "examples" / "complete-lesson-demo.json"))
        except (OSError, UnicodeError, ScriptError) as error:
            self._error(error)

    def _export(self):
        try:
            draft = self.current()
            name, _ = QFileDialog.getSaveFileName(
                self,
                "حفظ المسودة والوصف دون اعتماد أو مفاتيح",
                "Nova-full-lesson.json",
                "JSON (*.json)",
            )
            if not name:
                return
            path = Path(name)
            if path.suffix.lower() != ".json":
                path = path.with_suffix(".json")
                if (
                    path.exists()
                    and QMessageBox.question(
                        self, "استبدال الحزمة؟", "الملف موجود. هل تريد استبداله؟"
                    )
                    != QMessageBox.StandardButton.Yes
                ):
                    return
            draft.save(path)
        except (OSError, ScriptError) as error:
            self._error(error)

    def _request(self):
        try:
            if not self.adult.isChecked() or not self.consent.isChecked():
                raise ScriptError("أكد أهلية حساب المُعدّ البالغ ووافق على إرسال هذا الوصف تحديدًا.")
            request = LessonRequest(
                self.brief(),
                self.key.text(),
                True,
                True,
                self.allow_assets.isChecked(),
                self._current_provider(),
            )
            self.key.clear()
            self._reset_consent()
            self.requested.emit(request)
        except ScriptError as error:
            self._error(error)

    def cleanup(self):
        self.key.clear()
        self._reset_consent()
        self._preview_dir.cleanup()
