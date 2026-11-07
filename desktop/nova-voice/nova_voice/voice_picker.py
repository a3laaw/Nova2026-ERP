"""Independent language/model/speaker selection for each dialogue role."""

from PySide6.QtCore import Signal
from PySide6.QtWidgets import QVBoxLayout, QWidget

from .controls import combo, label
from .voices import VoiceSpec


class VoicePicker(QWidget):
    changed = Signal()

    def __init__(self, title: str, parent=None):
        super().__init__(parent)
        self._voices: list[VoiceSpec] = []
        self._preferred_path = ""
        self._preferred_speaker = 0
        self._speaker_model = ""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)
        self.title = label(title, "section")
        layout.addWidget(self.title)
        self.language_combo = combo()
        self.language_combo.addItem("كل اللغات المثبتة", "all")
        self.language_combo.addItem("العربية", "ar")
        self.language_combo.addItem("English", "en")
        self.language_combo.setAccessibleName(f"لغة {title}")
        layout.addWidget(self.language_combo)
        self.voice_combo = combo()
        self.voice_combo.setAccessibleName(f"نموذج {title}")
        layout.addWidget(self.voice_combo)
        self.speaker_label = label("المتحدث داخل النموذج", "muted")
        self.speaker_combo = combo()
        self.speaker_combo.setAccessibleName(f"المتحدث داخل {title}")
        layout.addWidget(self.speaker_label)
        layout.addWidget(self.speaker_combo)
        self.details = label("", "muted", True)
        layout.addWidget(self.details)
        self.language_combo.currentIndexChanged.connect(self._filter_changed)
        self.voice_combo.currentIndexChanged.connect(self._voice_changed)
        self.speaker_combo.currentIndexChanged.connect(self.changed)
        self._refill()

    def language(self) -> str:
        return self.language_combo.currentData() or "all"

    def selected_voice(self) -> VoiceSpec | None:
        value = self.voice_combo.currentData()
        return value if isinstance(value, VoiceSpec) else None

    def speaker_id(self) -> int:
        return self.speaker_combo.currentData() or 0

    def restore(self, language: str, path: str, speaker_id: int) -> None:
        self._preferred_path = path
        self._preferred_speaker = speaker_id
        self.language_combo.blockSignals(True)
        self.language_combo.setCurrentIndex(max(0, self.language_combo.findData(language)))
        self.language_combo.blockSignals(False)
        self._refill()

    def set_voices(self, voices: list[VoiceSpec], preferred_path: str = "") -> None:
        current = self.selected_voice()
        self._preferred_path = preferred_path or (
            str(current.model_path) if current else self._preferred_path
        )
        if current:
            self._preferred_speaker = self.speaker_id()
        self._voices = voices
        self._refill()

    def _filter_changed(self, *_args) -> None:
        self._preferred_path = ""
        self._preferred_speaker = 0
        self._refill()

    def _refill(self) -> None:
        voices = [
            voice
            for voice in self._voices
            if self.language() == "all" or voice.language_family == self.language()
        ]
        self.voice_combo.blockSignals(True)
        self.voice_combo.clear()
        for voice in voices:
            self.voice_combo.addItem(voice.label, voice)
        if not voices:
            missing = {
                "ar": "لا يوجد نموذج عربي مثبت",
                "en": "No English voice installed",
                "all": "لا توجد أصوات محلية بعد",
            }
            self.voice_combo.addItem(missing[self.language()])
        index = next(
            (i for i, voice in enumerate(voices) if str(voice.model_path) == self._preferred_path),
            0,
        )
        self.voice_combo.setCurrentIndex(index)
        self.voice_combo.blockSignals(False)
        self.voice_combo.setEnabled(bool(voices))
        self._voice_changed(restore=True)

    def _voice_changed(self, *_args, restore: bool = False) -> None:
        voice = self.selected_voice()
        previous_id = self._preferred_speaker if restore else 0
        if voice and str(voice.model_path) == self._speaker_model and not restore:
            previous_id = self.speaker_id()
        self.speaker_combo.blockSignals(True)
        self.speaker_combo.clear()
        multiple = voice is not None and voice.num_speakers > 1
        self.speaker_label.setVisible(multiple)
        self.speaker_combo.setVisible(multiple)
        if voice:
            self._speaker_model = str(voice.model_path)
            names = {i: name for name, i in voice.speakers}
            for speaker_id in range(voice.num_speakers):
                self.speaker_combo.addItem(
                    names.get(speaker_id, f"متحدث {speaker_id + 1}"), speaker_id
                )
            self.speaker_combo.setCurrentIndex(max(0, self.speaker_combo.findData(previous_id)))
            self.details.setText(f"{voice.language} · {voice.sample_rate:,} Hz · محلي")
            self._preferred_path = str(voice.model_path)
        else:
            self._speaker_model = ""
            self.details.setText("أضف نموذجًا بهذه اللغة من الجهاز أو USB، ثم اضغط «تحديث».")
        self.speaker_combo.blockSignals(False)
        self.changed.emit()
