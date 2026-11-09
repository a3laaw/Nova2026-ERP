"""Optional teacher authoring panel. Drafts never enter an export implicitly."""

import tempfile
from collections.abc import Callable
from dataclasses import dataclass, field, replace
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
from .scene_planner import manual_prompt
from .scenes import SceneError, VisualPlan, empty_plan, review_text
from .secondary_assets import (
    AssetPreparation,
    asset_info,
    cache_directory,
    clear_cache,
    preparation_matches,
    referenced_ids,
    use_local_fallbacks,
)
from .text import ScriptError
from .whiteboard import Lesson, save_whiteboard


@dataclass(frozen=True)
class PlannerRequest:
    source: dict = field(repr=False)
    key: str = field(repr=False)
    subject: str
    grade: str
    policy: str
    consent: bool
    adult: bool
    secondary_assets: bool = False


@dataclass(frozen=True)
class AssetRequest:
    source: dict = field(repr=False)
    plan: VisualPlan = field(repr=False)
    revision: int
    allow_download: bool = False


class ScenePicker(QWidget):
    changed = Signal()
    requested = Signal(object)
    example_requested = Signal()
    assets_requested = Signal(object)

    def __init__(
        self,
        lesson_provider: Callable[[], Lesson],
        parent=None,
        *,
        plan_adapter: Callable[[VisualPlan, Lesson], VisualPlan] | None = None,
        asset_cache: Path | None = None,
    ):
        super().__init__(parent)
        self._lesson_provider = lesson_provider
        self._plan_adapter = plan_adapter
        self._approved: VisualPlan | None = None
        self.revision = 0
        self._asset_cache = asset_cache if asset_cache is not None else cache_directory()
        self._preview_dir = tempfile.TemporaryDirectory(prefix="nova-scene-review-")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(
            label(
                "الصق السكريبت أولًا؛ منه يقترح النموذج الأجزاء والأفعال وتوقيت الشرح، "
                "لا تختار حيوانًا أو شكلًا أو حركة من كتالوج. يمكنه تركيب أجزاء بمفاصل "
                "وتتابعات حركة وتمثيل كروي مبسط 2.5D. المعاينة صامتة قبل اعتمادك. "
                "هذا ليس فهمًا مضمونًا أو محرك 3D عامًا؛ راجع المعنى والحساب واللغة والمواضع. "
                "لا توجد خرائط موثقة أو تلاوة/تجويد معتمدان.",
                "muted",
                True,
            )
        )
        hints = QHBoxLayout()
        self.subject = QLineEdit()
        self.subject.setMaxLength(80)
        self.subject.setPlaceholderText("المادة · اختياري")
        self.subject.setAccessibleName("المادة للمساعدة على فهم السكريبت، لا قالب رسم")
        self.grade = QLineEdit()
        self.grade.setMaxLength(80)
        self.grade.setPlaceholderText("الصف أو العمر · اختياري")
        self.grade.setAccessibleName("الصف أو العمر، بما فيه الإعدادي")
        self.policy = combo()
        self.policy.addItem("محتوى عام · يحتاج مراجعة", "general")
        self.policy.addItem("نصوص مقدسة · نص مراجع فقط", "sacred")
        self.policy.setAccessibleName("سياسة حماية النصوص المقدسة")
        hints.addWidget(self.subject, 1)
        hints.addWidget(self.grade, 1)
        hints.addWidget(self.policy, 1)
        layout.addLayout(hints)
        actions = QHBoxLayout()
        self.import_button = button("استيراد خطة JSON")
        self.import_button.clicked.connect(self._import)
        self.prompt_button = button("نسخ توجيه لخدمة تختارها")
        self.prompt_button.clicked.connect(self._copy_prompt)
        self.example_button = button("مثال رسوم محلي")
        self.example_button.clicked.connect(lambda: self.example_requested.emit())
        for widget in (self.import_button, self.prompt_button, self.example_button):
            actions.addWidget(widget)
        layout.addLayout(actions)
        resources = Disclosure("مصادر رسوم مجانية ثانوية · اختياري، لا تنزيل تلقائي")
        resources.content_layout.addWidget(
            label(
                "المحرّك المحلي هو الأساس. إن فعّلت الخيار يقترح المخطّط من السكريبت معرّفات "
                "ضمن 16 رسمًا مدققًا من Game-icons، لا تختار أنت حيوانًا من مكتبة. "
                "هذه صور ظلية ثابتة وليست مكتبة مفاصل أو محرك 3D. "
                "لا بحث إنترنت مفتوح أو تثبيت Konva/Three أو تشغيل كود. "
                "التجهيز المحلي يفحص الذاكرة فقط. التنزيل يحتاج إذنًا جديدًا، ويطلب ملفات "
                "مثبتة من GitHub دون حساب أو مفتاح أو إرسال الدرس/الصوت؛ يكشف العنوان الشبكي "
                "ومعرّفات الموارد للمصدر. CC BY 3.0 يتطلب حفظ النسبة والمصدر والترخيص "
                "والتغييرات في JSON وHTML والطباعة وبطاقات نهاية الفيديو. "
                "عند الغياب أو الفشل يظهر البديل المحلي الأصلي. كل تغيير يلغي اعتماد الخطة.",
                "muted",
                True,
            )
        )
        self.allow_assets = QCheckBox(
            "السماح للمخطّط باقتراح موارد مجانية ثانوية · للطلبات التالية فقط"
        )
        resources.content_layout.addWidget(self.allow_assets)
        self.prepare_assets_button = button("تجهيز موارد الخطة من الذاكرة المحلية")
        self.prepare_assets_button.clicked.connect(lambda: self._prepare_assets(False))
        self.download_assets_button = button("تنزيل موارد الخطة المقترحة بإذني")
        self.download_assets_button.clicked.connect(lambda: self._prepare_assets(True))
        self.local_assets_button = button("العودة إلى البدائل المحلية الأصلية")
        self.local_assets_button.clicked.connect(self._local_assets)
        self.clear_asset_cache_button = button("مسح ذاكرة الموارد الثانوية")
        self.clear_asset_cache_button.clicked.connect(self._clear_asset_cache)
        for widget in (
            self.prepare_assets_button,
            self.download_assets_button,
            self.local_assets_button,
            self.clear_asset_cache_button,
        ):
            resources.content_layout.addWidget(widget)
        layout.addWidget(resources)
        cloud = Disclosure("اقتراح عبر الإنترنت · اختياري ومجاني فقط")
        self.cloud_section = cloud
        cloud.content_layout.addWidget(
            label(
                "طلب نصي واحد إلى OpenRouter ومزوّد النموذج، بحساب المعلم البالغ 18+ فقط. "
                "يُرسل السكريبت والمادة والصف؛ لا أصوات أو ملفات أخرى. "
                "لا بيانات طلاب أو معلومات حساسة. النموذج openrouter/free فقط، "
                "سقف سعر صفر ومنع التدريب/الاحتفاظ بحسب مرشحات المزود. "
                "عند غياب نموذج يوافقها، أو نفاد الحصة، نتوقف دون تخفيفها أو شراء رصيد. "
                "قد تتغير المجانية والشروط، وليست خدمة غير محدودة. "
                "راجع شروط OpenRouter ومزوّديه وقوانين بلدك: "
                "openrouter.ai/terms وopenrouter.ai/privacy. "
                "للطلب الأول حد 12 خطوة و12000 حرف. "
                "الإلغاء أثناء الشبكة قد ينتظر مهلة الاتصال.",
                "muted",
                True,
            )
        )
        self.key = QLineEdit()
        self.key.setEchoMode(QLineEdit.EchoMode.Password)
        self.key.setMaxLength(512)
        self.key.setPlaceholderText("مفتاح OpenRouter · لهذا الطلب فقط، لا يُحفظ")
        self.key.setAccessibleName("مفتاح OpenRouter السري، لا يُكتب في السكريبت")
        self.key.setInputMethodHints(
            Qt.InputMethodHint.ImhSensitiveData | Qt.InputMethodHint.ImhNoPredictiveText
        )
        cloud.content_layout.addWidget(self.key)
        self.adult = QCheckBox("أنا المُعدّ البالغ (18+) وأقر أهلية الحساب وشروط المزود")
        self.consent = QCheckBox("أوافق على إرسال هذا الدرس الآن، بلا بيانات شخصية أو حساسة")
        cloud.content_layout.addWidget(self.adult)
        cloud.content_layout.addWidget(self.consent)
        self.request_button = button("اقتراح مشاهد · طلب مجاني واحد", "primary")
        self.request_button.clicked.connect(self._request)
        cloud.content_layout.addWidget(self.request_button)
        layout.addWidget(cloud)
        advanced = Disclosure("بيانات الخطة المتقدمة · تعديل اختياري، لا يلزم تركيب الأجزاء يدويًا")
        self.advanced_section = advanced
        advanced.content_layout.addWidget(
            label(
                "مسودة JSON آمنة، وليست SVG أو كودًا. "
                "المراجعة والمعاينة بالأسفل تكفيان لاعتماد المقترح.",
                "muted",
                True,
            )
        )
        self.plan_edit = QPlainTextEdit()
        self.plan_edit.setAccessibleName("JSON خطة المشاهد المقترحة")
        self.plan_edit.setPlaceholderText("استورد خطة، أو انسخ توجيهًا، أو اطلب اقتراحًا مجانيًا…")
        self.plan_edit.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        self.plan_edit.setMinimumHeight(190)
        self.plan_edit.setMaximumHeight(320)
        advanced.content_layout.addWidget(self.plan_edit)
        layout.addWidget(advanced)
        reviews = QHBoxLayout()
        self.review_button = button("تحقق واعرض الفروقات")
        self.review_button.clicked.connect(self._review)
        self.preview_button = button("معاينة الرسم بلا صوت")
        self.preview_button.clicked.connect(self._preview)
        self.export_button = button("حفظ خطة JSON")
        self.export_button.clicked.connect(self._export)
        for widget in (self.review_button, self.preview_button, self.export_button):
            reviews.addWidget(widget)
        layout.addLayout(reviews)
        self.review = QPlainTextEdit()
        self.review.setReadOnly(True)
        self.review.setAccessibleName("مراجعة النص الأصلي والعرض والنطق ووصف الرسوم")
        self.review.setPlaceholderText(
            "ستظهر هنا الفروقات والتنبيهات بعد التحقق، دون تغيير السكريبت الأصلي."
        )
        self.review.setMinimumHeight(160)
        self.review.setMaximumHeight(300)
        layout.addWidget(self.review)
        self.use_plan = QCheckBox("تضمين المشاهد في تصدير السبورة فقط")
        layout.addWidget(self.use_plan)
        self.approve_button = button("راجعت الخطة والنطق · اعتماد للتصدير", "primary")
        self.approve_button.clicked.connect(self._approve)
        layout.addWidget(self.approve_button)
        self.state = label("اختياري: الوضع القديم يعمل كما هو دون خطة أو اتصال.", "muted", True)
        layout.addWidget(self.state)
        self.plan_edit.textChanged.connect(self._draft_changed)
        self.use_plan.toggled.connect(self._use_changed)
        self.subject.textChanged.connect(self.invalidate_source)
        self.grade.textChanged.connect(self.invalidate_source)
        self.key.textChanged.connect(self._reset_consent)
        self.policy.currentIndexChanged.connect(self.invalidate_source)
        self.allow_assets.toggled.connect(self.invalidate_source)
        self._use_changed()

    def _reset_consent(self, *_):
        self.consent.setChecked(False)

    def invalidate_source(self, *_):
        self.revision += 1
        self._approved = None
        self._reset_consent()
        self.review.clear()
        self._state()
        self.changed.emit()

    def _draft_changed(self):
        self.revision += 1
        self._approved = None
        self.review.clear()
        if self.plan_edit.toPlainText().strip():
            self.use_plan.setChecked(True)
        self._state()
        self.changed.emit()

    def _use_changed(self, *_):
        self.revision += 1
        self._state()
        self.changed.emit()

    def _state(self):
        if not self.use_plan.isChecked():
            message = "التصدير التقليدي بلا مشاهد؛ توليد الصوت فقط لا يستخدم هذه الخطة."
        elif self._approved:
            message = "خطة معتمدة للسكريبت الحالي. أي تعديل في السكريبت أو JSON يلغي الاعتماد."
        else:
            message = (
                "مسودة غير معتمدة أو سكريبت تغيّر: راجع واعتمد قبل تصدير السبورة، "
                "أو ألغِ تضمين المشاهد."
            )
        if self.policy.currentData() == "sacred":
            message = "حماية النصوص المقدسة: لا إرسال أو نطق آلي. " + message
        self.state.setText(message)

    def export_ready(self) -> bool:
        return not self.use_plan.isChecked() or self._approved is not None

    def audio_allowed(self) -> bool:
        return self.policy.currentData() != "sacred" and not (
            self.use_plan.isChecked()
            and self._approved
            and self._approved.to_data()["policy"] == "sacred"
        )

    def approved_for(self, lesson: Lesson) -> VisualPlan | None:
        if not self.use_plan.isChecked():
            return None
        if self._approved is None:
            raise SceneError("راجع خطة المشاهد واعتمدها، أو ألغِ تضمينها للتصدير التقليدي.")
        return VisualPlan.from_data(self._approved.to_data(), lesson.manifest())

    def _current(self) -> tuple[Lesson, VisualPlan]:
        lesson = self._lesson_provider()
        plan = VisualPlan.from_json(self.plan_edit.toPlainText(), lesson.manifest())
        if self.policy.currentData() == "sacred" and plan.to_data()["policy"] != "sacred":
            raise SceneError("وضع النصوص المقدسة يحتاج خطة policy=sacred بلا رسوم أو إعادة صياغة.")
        if self._plan_adapter is not None:
            plan = self._plan_adapter(plan, lesson)
        return lesson, plan

    def _error(self, error):
        QMessageBox.warning(self, "راجع خطة المشاهد", str(error))

    def set_draft(self, plan: VisualPlan):
        self.revision += 1  # Identical reimports/results must also invalidate in-flight work.
        self._approved = None
        if plan.to_data()["policy"] == "sacred":
            self.policy.setCurrentIndex(1)
        self.plan_edit.setPlainText(plan.to_json())
        self.use_plan.setChecked(True)
        self._review()
        self._state()
        self.changed.emit()

    def _import(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "استيراد خطة للسكريبت الحالي", "", "JSON (*.json)"
        )
        if not path:
            return
        try:
            source = self._lesson_provider().manifest()
            self.set_draft(VisualPlan.load(Path(path), source))
        except (OSError, UnicodeError, ScriptError) as error:
            self._error(error)

    def _copy_prompt(self):
        try:
            source = self._lesson_provider().manifest()
            if self.policy.currentData() == "sacred":
                plan = empty_plan(source, subject=self.subject.text(), grade=self.grade.text())
                plan["policy"] = "sacred"
                plan["notes"] = ["النص كما كتبه المعلم؛ لا توثيق آلي أو تلاوة معتمدة."]
                self.set_draft(VisualPlan.from_data(plan, source))
                return
            prompt = manual_prompt(
                source,
                self.subject.text(),
                self.grade.text(),
                secondary_assets=self.allow_assets.isChecked(),
            )
            QApplication.clipboard().setText(prompt)
            self.state.setText(
                "نُسخ التوجيه والنص إلى الحافظة فقط؛ لا اتصال. لصقه في خدمة أخرى "
                "قرارك، ثم استورد رد JSON."
            )
        except ScriptError as error:
            self._error(error)

    def _review(self):
        try:
            lesson, plan = self._current()
            self.review.setPlainText(review_text(plan, lesson.manifest()))
        except ScriptError as error:
            self._error(error)

    def _approve(self):
        try:
            lesson, plan = self._current()
            self.review.setPlainText(review_text(plan, lesson.manifest()))
            if (
                QMessageBox.question(
                    self,
                    "اعتماد بعد المراجعة",
                    "هل راجعت وصف الرسم ومعاينته وكل فرق بين الأصل والعرض والنطق؟ "
                    "الرسوم العامة ليست خرائط أو نصوصًا دينية موثقة. "
                    "الموافقة هنا لا ترسل شيئًا للإنترنت.",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                    QMessageBox.StandardButton.No,
                )
                != QMessageBox.StandardButton.Yes
            ):
                return
            self.use_plan.setChecked(True)
            self._approved = plan
            self._state()
            self.changed.emit()
        except ScriptError as error:
            self._error(error)

    def _preview(self):
        try:
            lesson, plan = self._current()
            path = Path(self._preview_dir.name) / "Nova-DRAFT-review.html"
            save_whiteboard(replace(lesson, visuals=plan), path)
            if not QDesktopServices.openUrl(QUrl.fromLocalFile(str(path))):
                raise SceneError(
                    "تعذّر فتح المتصفح. استخدم حفظ الخطة أو معاينة السبورة بعد اعتمادها."
                )
            self.state.setText("فُتحت معاينة مسودة مؤقتة بلا صوت أو إنترنت؛ لم تُعتمد للتصدير بعد.")
        except (OSError, ScriptError) as error:
            self._error(error)

    def _export(self):
        try:
            _, plan = self._current()
            path, _ = QFileDialog.getSaveFileName(
                self, "حفظ خطة لإعادة استخدامها محليًا", "Nova-scenes.json", "JSON (*.json)"
            )
            if path:
                destination = Path(path)
                if destination.suffix.lower() != ".json":
                    destination = destination.with_suffix(".json")
                    if (
                        destination.exists()
                        and QMessageBox.question(
                            self, "استبدال الخطة؟", "الملف موجود. هل تريد استبداله؟"
                        )
                        != QMessageBox.StandardButton.Yes
                    ):
                        return
                plan.save(destination)
        except (OSError, ScriptError) as error:
            self._error(error)

    def _prepare_assets(self, download: bool):
        try:
            lesson, plan = self._current()
            data = plan.to_data()
            if data["policy"] != "general" or self.policy.currentData() != "general":
                raise SceneError("حماية النصوص المقدسة لا تسمح بموارد ثانوية.")
            identifiers = referenced_ids(data["steps"])
            if not identifiers:
                raise SceneError("لا موارد ثانوية مقترحة في الخطة الحالية؛ الرسم المحلي كافٍ.")
            if download:
                notice = "\n".join(
                    identifier
                    + " · "
                    + asset_info(identifier)["credit"]["attribution"]
                    + " · CC BY 3.0"
                    for identifier in identifiers
                )
                if (
                    QMessageBox.question(
                        self,
                        "إذن تنزيل مستقل لهذه الموارد فقط",
                        notice + "\n\nطلب ملفات عامة مثبتة من api.github.com، لا بحث مفتوح أو "
                        "إرسال سكريبت/صوت/مفتاح. قد تُطبق حصة GitHub المجانية. "
                        "تُحفظ النسبة والتغييرات، ويُستخدم البديل المحلي عند الفشل. "
                        "الإلغاء قد ينتظر مهلة 20 ثانية؛ راجع المعاينة واعتمد من جديد بعد التجهيز. "
                        "هل تأذن بهذه التنزيلات؟",
                        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                        QMessageBox.StandardButton.No,
                    )
                    != QMessageBox.StandardButton.Yes
                ):
                    return
            self.assets_requested.emit(
                AssetRequest(lesson.manifest(), plan, self.revision, download)
            )
        except ScriptError as error:
            self._error(error)

    def apply_assets(self, result: AssetPreparation, request: AssetRequest):
        lesson, current = self._current()
        if self.revision != request.revision or not preparation_matches(
            result, current, lesson.manifest()
        ):
            raise SceneError(
                "تغيّرت الخطة أو النص أو الخيارات أثناء التجهيز؛ لم تُطبّق النتيجة القديمة."
            )
        prepared = VisualPlan.from_data(result.plan.to_data(), lesson.manifest())
        if self._plan_adapter is not None:
            prepared = self._plan_adapter(prepared, lesson)
        self.set_draft(prepared)  # Always revoke approval, even for an identical result.
        self.review.setPlainText(result.summary() + "\n\n" + self.review.toPlainText())

    def _local_assets(self):
        try:
            lesson, plan = self._current()
            self.set_draft(use_local_fallbacks(plan, lesson.manifest()))
        except ScriptError as error:
            self._error(error)

    def _clear_asset_cache(self):
        if (
            QMessageBox.question(
                self,
                "مسح ذاكرة الموارد فقط",
                "لن تتغير الأصوات أو الخطط أو الملفات المصدّرة. "
                "الموارد المضمّنة فيها تبقى مع نسبتها. "
                "هل تمسح ملفات الموارد المدققة من الذاكرة المحلية؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        try:
            count = clear_cache(self._asset_cache)
            self.state.setText(f"مُسح {count} مورد من الذاكرة؛ لم تتغير الخطة أو ملفاتك المصدّرة.")
        except OSError as error:
            self._error(error)

    def _request(self):
        try:
            if not self.consent.isChecked() or not self.adult.isChecked():
                raise SceneError("أكد أهلية المعلم البالغ ثم وافق على إرسال هذا الدرس تحديدًا.")
            source = self._lesson_provider().manifest()
            request = PlannerRequest(
                source,
                self.key.text(),
                self.subject.text(),
                self.grade.text(),
                self.policy.currentData(),
                True,
                True,
                self.allow_assets.isChecked(),
            )
            self.key.clear()
            self.consent.setChecked(False)
            self.requested.emit(request)
        except ScriptError as error:
            self._error(error)

    def cleanup(self):
        self.key.clear()
        self.consent.setChecked(False)
        self._preview_dir.cleanup()
