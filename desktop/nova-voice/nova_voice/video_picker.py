"""Native opt-in conversion panel; no encoder discovery/download or saved review."""

from dataclasses import dataclass
from pathlib import Path

from PySide6.QtCore import Qt, QUrl, Signal
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import QCheckBox, QFileDialog, QHBoxLayout, QVBoxLayout, QWidget

from .controls import button, label
from .video import VideoResult


@dataclass(frozen=True)
class ConversionRequest:
    source: Path
    ffmpeg: Path


class VideoPicker(QWidget):
    requested = Signal(object)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._source: Path | None = None
        self._ffmpeg: Path | None = None
        self._result: Path | None = None
        self._allowed = True
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(14)
        layout.addWidget(label("MP4 متوافق · تحويل محلي اختياري", "section"))
        layout.addWidget(
            label(
                "صدّر الفيديو أولًا من HTML، ثم اختره هنا للتحويل الفعلي إلى H.264/AAC. "
                "لا يولّد هذا التبويب درسًا أو صوتًا جديدًا، ولا يسجّل الشاشة. "
                "لا يكفي تغيير امتداد WebM إلى MP4.",
                "muted",
                True,
            )
        )
        for text, name, callback in (
            ("1 · اختيار فيديو WebM / MP4", "source", self._choose_source),
            ("2 · اختيار FFmpeg محلي موثوق", "ffmpeg", self._choose_ffmpeg),
        ):
            row = QHBoxLayout()
            control = button(text)
            control.clicked.connect(callback)
            row.addWidget(control)
            caption = label("لم يُختر ملف بعد.", "muted", True)
            caption.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
            row.addWidget(caption, 1)
            setattr(self, name + "_label", caption)
            layout.addLayout(row)
        layout.addWidget(
            label(
                "FFmpeg غير مضمّن ولا يُنزّل تلقائيًا. اختر بنفسك بناءً موثوقًا وترخيصًا مناسبًا "
                "يدعم libx264 وAAC. اختيار ملف تنفيذي يعني السماح بتشغيله على جهازك؛ "
                "لا تختَر ملفًا مجهول المصدر. لا إنترنت أثناء التحويل.",
                "setup",
                True,
            )
        )
        self.review = QCheckBox(
            "راجعت الفيديو والنطق وحقوق استخدامه وأوافق على تشغيل FFmpeg المختار."
        )
        self.review.setChecked(False)
        self.review.toggled.connect(self._refresh)
        layout.addWidget(self.review)
        self.convert_button = button("3 · تحويل وحفظ MP4", "primary")
        self.convert_button.clicked.connect(self._request)
        layout.addWidget(self.convert_button)
        self.note = label(
            "1280×720 · 20fps · H.264 Main / AAC-LC عند وجود صوت · لا اختراع لمسار صوت.",
            "muted",
            True,
        )
        layout.addWidget(self.note)
        layout.addWidget(
            label(
                "يُتحقق من الترميزات ويُفك الفيديو كاملًا قبل حفظ النتيجة؛ الإلغاء يزيل المؤقتات "
                "ولا يستبدل الأصل. حد 15 دقيقة و128 MiB للمصدر والخرج، ومهلة 30 دقيقة لكل مرحلة. "
                "التحويل قد يقلل الجودة ويستهلك المعالج؛ لا ضمان لكل هاتف أو جهاز 4GB.",
                "muted",
                True,
            )
        )
        self.result_label = label("لا نتيجة بعد.", "muted", True)
        self.result_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        layout.addWidget(self.result_label)
        self.open_button = button("فتح الفيديو الناتج")
        self.open_button.setEnabled(False)
        self.open_button.clicked.connect(self._open_result)
        layout.addWidget(self.open_button)
        layout.addStretch()
        self._refresh()

    def _select(self, path: Path, *, encoder: bool = False) -> None:
        # Selection (including the encoder) always invalidates session review.
        if encoder:
            self._ffmpeg = path
        else:
            self._source = path
        caption = self.ffmpeg_label if encoder else self.source_label
        caption.setText(path.name)
        caption.setToolTip(str(path))
        self.review.setChecked(False)
        self._refresh()

    def _choose_source(self) -> None:
        name, _ = QFileDialog.getOpenFileName(self, "فيديو محلي موجود", "", "Video (*.webm *.mp4)")
        if name:
            self._select(Path(name))

    def _choose_ffmpeg(self) -> None:
        name, _ = QFileDialog.getOpenFileName(
            self, "اختر FFmpeg التنفيذي الموثوق", "", "Executable (*)"
        )
        if name:
            self._select(Path(name), encoder=True)

    def current(self) -> ConversionRequest | None:
        if self._allowed and self.review.isChecked() and self._source and self._ffmpeg:
            return ConversionRequest(self._source, self._ffmpeg)
        return None

    def set_allowed(self, allowed: bool) -> None:
        self._allowed = allowed
        if not allowed:
            self.review.setChecked(False)
        self.review.setEnabled(allowed)
        self._refresh()

    def _refresh(self) -> None:
        self.convert_button.setEnabled(self.current() is not None)
        self.note.setText(
            "1280×720 · 20fps · H.264 Main / AAC-LC عند وجود صوت · لا اختراع لمسار صوت."
            if self._allowed
            else "وضع النصوص المقدسة: الفيديو الجديد والتحويل من هذا التبويب غير متاحين. "
            "لا اكتشاف آلي لمحتوى الملفات أو اعتماد تلاوة."
        )

    def _request(self) -> None:
        if request := self.current():
            self.requested.emit(request)

    def set_result(self, result: VideoResult) -> None:
        self._result = result.path
        sound = "AAC-LC" if result.has_audio else "صامت"
        self.result_label.setText(
            f"{result.path}\nH.264 Main · {sound} · {result.duration_seconds:.1f}s · "
            "فُك الخرج كاملًا محليًا؛ جرّبه على الجهاز المستهدف."
        )
        self.open_button.setEnabled(True)
        self.review.setChecked(False)

    def _open_result(self) -> None:
        if self._result:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(self._result)))
