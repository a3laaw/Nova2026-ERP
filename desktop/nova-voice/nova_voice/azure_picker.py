"""Native Azure settings and per-operation spoken-text consent; no persistence."""

import time

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QDialog,
    QHBoxLayout,
    QLineEdit,
    QPlainTextEdit,
    QVBoxLayout,
    QWidget,
)

from .azure_speech import (
    AZURE_VOICES,
    KEY_TTL_SECONDS,
    AzureCredentials,
    AzureError,
    AzurePlan,
)
from .controls import button, combo, label


class AzurePicker(QWidget):
    changed = Signal()
    forgotten = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.revision = 0
        self._key_entered_at = 0.0
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)
        layout.addWidget(label("Azure Speech · اختياري وسحابي", "section"))
        layout.addWidget(
            label(
                "أنشئ مورد Speech بفئة Free F0. المفتاح وحده لا يثبت فئة المورد؛ "
                "إن أدخلت مفتاح S0 فقد تُحتسب رسوم لدى Microsoft. لا يغيّر البرنامج الفئة.",
                "setup",
                True,
            )
        )
        layout.addWidget(label("مفتاح Speech · لا ترسله في المحادثة", "muted"))
        self.key_edit = QLineEdit()
        self.key_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.key_edit.setMaxLength(256)
        self.key_edit.setAccessibleName("مفتاح Azure Speech السري للجلسة")
        self.key_edit.setPlaceholderText("Speech key")
        self.key_edit.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        layout.addWidget(self.key_edit)
        layout.addWidget(label("المنطقة Region · من صفحة المورد", "muted"))
        self.region_edit = QLineEdit()
        self.region_edit.setMaxLength(40)
        self.region_edit.setAccessibleName("منطقة مورد Azure Speech")
        self.region_edit.setPlaceholderText("eastus / westeurope / uaenorth")
        self.region_edit.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        layout.addWidget(self.region_edit)
        self.f0_check = QCheckBox("أؤكد أن مورد Speech هو Free F0")
        layout.addWidget(self.f0_check)
        self.first_voice = combo()
        self.second_voice = combo()
        self.first_voice.setAccessibleName("صوت Azure للراوي أو الدور الأول")
        self.second_voice.setAccessibleName("صوت Azure للدور الثاني")
        for voice in AZURE_VOICES:
            self.first_voice.addItem(voice.label, voice)
            self.second_voice.addItem(voice.label, voice)
        self.second_voice.setCurrentIndex(2)
        layout.addWidget(label("الراوي / الصوت الأول", "muted"))
        layout.addWidget(self.first_voice)
        self.second_label = label("الصوت الثاني · مستقل عن الأول", "muted")
        layout.addWidget(self.second_label)
        layout.addWidget(self.second_voice)
        self.forget_button = button("نسيان مفتاح Azure الآن")
        self.forget_button.clicked.connect(self.forget)
        layout.addWidget(self.forget_button)
        layout.addWidget(
            label(
                "المفتاح في ذاكرة النافذة فقط حتى 30 دقيقة من إدخاله؛ لا حفظ في الإعدادات "
                "أو HTML. كل عملية تحتاج مراجعة النص وإذن إرسال جديدًا. الأصوات البريطانية "
                "تسمية منطقة وليست شهادة RP. عدد الحروف المعروض تقديري، لا رصيد الحساب.",
                "muted",
                True,
            )
        )
        self.key_edit.textChanged.connect(self._key_changed)
        self.region_edit.textChanged.connect(self._region_changed)
        self.f0_check.toggled.connect(self._touch)
        self.first_voice.currentIndexChanged.connect(self._touch)
        self.second_voice.currentIndexChanged.connect(self._touch)
        self.timer = QTimer(self)
        self.timer.setInterval(1000)
        self.timer.timeout.connect(self.expire)
        self.timer.start()
        self.set_dialogue(False)

    def _touch(self, *_args):
        self.revision += 1
        self.changed.emit()

    def _key_changed(self, *_args):
        self._key_entered_at = time.monotonic() if self.key_edit.text() else 0.0
        self.f0_check.setChecked(False)
        self._touch()

    def _region_changed(self, *_args):
        self.f0_check.setChecked(False)
        self._touch()

    def credentials(self) -> AzureCredentials:
        if not self._key_entered_at or time.monotonic() >= self._key_entered_at + KEY_TTL_SECONDS:
            raise AzureError("أدخل مفتاح Azure للجلسة؛ انتهت صلاحيته المحلية أو لم يُدخل.")
        return AzureCredentials(
            self.key_edit.text().strip(),
            self.region_edit.text(),
            self.f0_check.isChecked(),
            self._key_entered_at + KEY_TTL_SECONDS,
        )

    def ready(self) -> bool:
        try:
            self.credentials()
        except AzureError:
            return False
        return True

    def expire(self):
        if self._key_entered_at and time.monotonic() >= self._key_entered_at + KEY_TTL_SECONDS:
            self.forget()

    def forget(self):
        self.key_edit.setText("")
        self.f0_check.setChecked(False)
        self._key_entered_at = 0.0
        self._touch()
        self.forgotten.emit()

    def set_dialogue(self, dialogue: bool):
        self.second_label.setVisible(dialogue)
        self.second_voice.setVisible(dialogue)


class AzureConsentDialog(QDialog):
    def __init__(self, plan: AzurePlan, region: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle("مراجعة النص قبل إرساله إلى Azure")
        screen = QApplication.primaryScreen()
        size = screen.availableGeometry() if screen else None
        self.resize(
            min(820, size.width() - 40) if size else 820,
            min(700, size.height() - 60) if size else 700,
        )
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.addWidget(label("لن يبدأ الإرسال دون موافقتك", "section"))
        layout.addWidget(
            label(
                f"المستلم Microsoft Azure Speech · المنطقة {region}. "
                f"{plan.characters:,} حرفًا تقديريًا في {len(plan.requests)} طلبًا قصيرًا. "
                "العدّ ليس رصيد Azure ولا يثبت المجانية. أكّدت أنت F0؛ لا يمكن إثباته بالمفتاح.",
                "setup",
                True,
            )
        )
        layout.addWidget(
            label(
                "هذه هي المقاطع المنطوقة الفعلية فقط، لا عناوين الدرس أو وصف الرسوم أو ملف HTML. "
                "سطور الترقيم وأسماء الأصوات أدناه للمراجعة ولا تُرسل كنص منطوق. "
                "العنوان أو الوصف المكتوب داخل مقطع منطوق سيُرسل كجزء منه. "
                "تقول Microsoft إن واجهة التوليد الفوري لا تخزن نص الإدخال أو الصوت الناتج؛ "
                "هذا ليس تعهدًا بعدم وجود بيانات تشغيل أو فوترة. لا تستخدم بيانات طلاب حساسة.",
                "muted",
                True,
            )
        )
        self.spoken_text = QPlainTextEdit()
        self.spoken_text.setReadOnly(True)
        self.spoken_text.setAccessibleName("المقاطع المنطوقة التي ستُرسل إلى Microsoft")
        self.spoken_text.setPlainText(plan.review_text)
        layout.addWidget(self.spoken_text, 1)
        self.review_check = QCheckBox("راجعت النص وأوافق على إرساله لهذه العملية فقط")
        layout.addWidget(self.review_check)
        layout.addWidget(
            label(
                "الإلغاء أو انتهاء الحصة يوقف العملية، بلا إعادة تلقائية أو صوت بديل. "
                "قد يكتمل طلب أُرسل بالفعل ويستهلك الحصة رغم الإلغاء؛ الملفات السابقة تبقى كما هي.",
                "muted",
                True,
            )
        )
        actions = QHBoxLayout()
        self.cancel_button = button("رجوع بلا إرسال")
        self.cancel_button.clicked.connect(self.reject)
        self.cancel_button.setDefault(True)
        self.allow_button = button("أوافق وأبدأ هذه العملية", "primary")
        self.allow_button.setAutoDefault(False)
        self.allow_button.setEnabled(False)
        self.allow_button.clicked.connect(self.accept)
        self.review_check.toggled.connect(self.allow_button.setEnabled)
        actions.addWidget(self.cancel_button)
        actions.addWidget(self.allow_button)
        layout.addLayout(actions)

    def accept(self):
        if self.review_check.isChecked():
            super().accept()
