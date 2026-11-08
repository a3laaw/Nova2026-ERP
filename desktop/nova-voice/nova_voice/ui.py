"""Arabic-first Windows desktop interface. No servers or browser dependencies."""

import logging
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from PySide6.QtCore import Qt, QUrl
from PySide6.QtGui import QAction, QCloseEvent, QDesktopServices, QIcon, QKeySequence, QTextCursor
from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer
from PySide6.QtWidgets import (
    QApplication,
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QProgressBar,
    QScrollArea,
    QSlider,
    QSpinBox,
    QStyle,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from . import __version__
from .appearance_picker import AppearancePicker
from .controls import button, card, clock, combo, label
from .dialogue import (
    BILINGUAL_EXAMPLE,
    has_voice_markers,
    parse_dialogue,
    preview_dialogue,
    tag_line,
)
from .engine import (
    AudioError,
    DialogueVoice,
    RenderOptions,
    RenderResult,
    SpeechEngine,
    validate_dialogue_cast,
)
from .html_export import (
    MAX_HTML_BYTES,
    HtmlAudioResult,
    HtmlExportError,
    render_html,
    validate_destination,
)
from .storage import (
    application_dir,
    load_preferences,
    resource_dir,
    save_preferences,
    user_data_dir,
)
from .text import MAX_CHARACTERS, ScriptError, preview_text, read_script, validate_text
from .theme import STYLESHEET
from .voice_picker import VoicePicker
from .voices import VoiceError, VoiceLibrary, VoiceSpec
from .whiteboard import (
    WHITEBOARD_EXAMPLE,
    Lesson,
    WhiteboardPage,
    WhiteboardResult,
    parse_lesson,
    render_whiteboard_audio,
    save_whiteboard,
    validate_lesson_cast,
)
from .worker import TaskWorker


class MainWindow(QMainWindow):
    def __init__(self, data_dir: Path | None = None):
        super().__init__()
        self.data_dir = data_dir or user_data_dir()
        self.preferences = load_preferences(self.data_dir)
        self.library = VoiceLibrary(self.data_dir / "voices", application_dir() / "voices")
        self.engine = SpeechEngine()
        self.voices: list[VoiceSpec] = []
        self.worker: TaskWorker | None = None
        self._closing = False
        self._result_file: Path | None = None
        self._html_source: Path | None = None
        self._html_result_file: Path | None = None
        self._board_source: Path | None = None
        self._board_lesson: Lesson | None = None
        self._board_open_file: Path | None = None
        self._preview_directory = tempfile.TemporaryDirectory(prefix="nova-voice-preview-")
        self._preview_number = 0
        self._progress_kind = "render"
        self._cleanup_done = False
        self.setWindowTitle(f"Nova Voice — صوت وسبورة تفاعلية · {__version__}")
        self.setWindowIcon(QIcon(str(resource_dir() / "assets" / "icon.svg")))
        self.setStyleSheet(STYLESHEET)
        screen = QApplication.primaryScreen()
        available = screen.availableGeometry() if screen else None
        self.setMinimumSize(
            min(940, available.width() - 40) if available else 940,
            min(640, available.height() - 40) if available else 640,
        )
        self.resize(
            min(1180, available.width() - 60) if available else 1180,
            min(850, available.height() - 70) if available else 850,
        )
        self._build_ui()
        self._build_player()
        self._restore_preferences()
        self.refresh_voices(self.preferences.voice_path)
        self._update_text_stats()
        self._shortcuts()

    def _build_ui(self) -> None:
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        canvas = QWidget()
        canvas.setObjectName("canvas")
        root = QVBoxLayout(canvas)
        root.setContentsMargins(28, 24, 28, 24)
        root.setSpacing(18)
        scroll.setWidget(canvas)
        self.setCentralWidget(scroll)

        heading = QHBoxLayout()
        titles = QVBoxLayout()
        titles.setSpacing(5)
        titles.addWidget(label("Nova Voice", "title"))
        titles.addWidget(label("من سكريبت مكتوب إلى صوت وسبورة تفاعلية.", "muted"))
        heading.addLayout(titles)
        heading.addStretch()
        heading.addWidget(label("محلي بالكامل · دون إنترنت", "privacy"))
        about = button("حول البرنامج")
        about.clicked.connect(self._about)
        heading.addWidget(about)
        root.addLayout(heading)

        columns = QHBoxLayout()
        columns.setSpacing(18)
        editor_card, editor_layout = card()
        editor_header = QHBoxLayout()
        editor_header.addWidget(label("السكريبت", "section"))
        editor_header.addStretch()
        self.import_text_button = button("استيراد TXT")
        self.import_text_button.clicked.connect(self._import_text)
        self.clear_button = button("مسح")
        self.clear_button.clicked.connect(self._clear_text)
        editor_header.addWidget(self.import_text_button)
        editor_header.addWidget(self.clear_button)
        editor_layout.addLayout(editor_header)
        self.dialogue_toolbar = QWidget()
        turn_actions = QHBoxLayout(self.dialogue_toolbar)
        turn_actions.setContentsMargins(0, 0, 0, 0)
        self.tag_first_button = button("وسم الفقرة [1]")
        self.tag_first_button.setToolTip("ضع المؤشر في الفقرة لتحديد الصوت الأول · Ctrl+1")
        self.tag_first_button.clicked.connect(lambda: self._tag_paragraph(1))
        self.tag_second_button = button("وسم الفقرة [2]")
        self.tag_second_button.setToolTip("ضع المؤشر في الفقرة لتحديد الصوت الثاني · Ctrl+2")
        self.tag_second_button.clicked.connect(lambda: self._tag_paragraph(2))
        self.dialogue_example_button = button("مثال عربي / English")
        self.dialogue_example_button.clicked.connect(self._dialogue_example)
        turn_actions.addWidget(self.tag_first_button)
        turn_actions.addWidget(self.tag_second_button)
        turn_actions.addWidget(self.dialogue_example_button)
        editor_layout.addWidget(self.dialogue_toolbar)
        self.dialogue_hint = label(
            "ابدأ كلام كل شخص بوسم <span dir='ltr'>[1]</span> أو "
            "<span dir='ltr'>[2]</span>؛ يمكن تبديل الصوت داخل السطر نفسه. "
            "الإغلاق اختياري: <span dir='ltr'>[1] نص عربي [/1]</span>، "
            "<span dir='ltr'>[2] English [/2]</span>. "
            "لا تبدأ بوسم إغلاق. اختر الصوت واللغة لكل دور؛ الوسوم لا تظهر على السبورة ولا تُنطق.",
            "setup",
            True,
        )
        self.dialogue_hint.setTextFormat(Qt.TextFormat.RichText)
        editor_layout.addWidget(self.dialogue_hint)
        self.editor = QPlainTextEdit()
        self.editor.setAccessibleName("نص السكريبت")
        self.editor.setPlaceholderText(
            "اكتب أو الصق السكريبت هنا…\n\n"
            "ابدأ بفكرة، وأعطها صوتًا.\n"
            "افصل الفقرات بسطر جديد لإضافة وقفة بينها."
        )
        option = self.editor.document().defaultTextOption()
        option.setTextDirection(Qt.LayoutDirection.LayoutDirectionAuto)
        self.editor.document().setDefaultTextOption(option)
        self.editor.setMinimumHeight(280)
        self.editor.textChanged.connect(self._update_text_stats)
        editor_layout.addWidget(self.editor, 1)
        self.text_stats = label("", "muted")
        editor_layout.addWidget(self.text_stats)
        editor_layout.addWidget(
            label(
                "النص لا يغادر جهازك ولا يُحفظ تلقائيًا. "
                "يمكن تشكيل الكلمات العربية الملتبسة لتحسين النطق.",
                "muted",
                True,
            )
        )
        columns.addWidget(editor_card, 7)

        settings_card, settings = card()
        settings_card.setMinimumWidth(310)
        settings_card.setMaximumWidth(410)
        settings.addWidget(label("إعدادات الصوت", "section"))
        self.mode_combo = combo()
        self.mode_combo.addItem("راوٍ واحد", "single")
        self.mode_combo.addItem("حوار بين صوتين", "dialogue")
        self.mode_combo.setAccessibleName("نوع السكريبت")
        self.mode_combo.currentIndexChanged.connect(self._mode_changed)
        settings.addWidget(self.mode_combo)
        self.voice_tabs = QTabWidget()
        self.primary_voice = VoicePicker("الراوي")
        self.secondary_voice = VoicePicker("الصوت الثاني · [2]")
        self.voice_tabs.addTab(self.primary_voice, "الراوي")
        self.voice_tabs.addTab(self.secondary_voice, "الصوت 2")
        self.primary_voice.changed.connect(self._update_buttons)
        self.secondary_voice.changed.connect(self._update_buttons)
        settings.addWidget(self.voice_tabs)
        voice_actions = QHBoxLayout()
        self.add_voice_button = button("إضافة نموذج")
        self.add_voice_button.clicked.connect(self._import_voice)
        self.refresh_button = button("تحديث")
        self.refresh_button.clicked.connect(lambda: self.refresh_voices())
        voice_actions.addWidget(self.add_voice_button, 1)
        voice_actions.addWidget(self.refresh_button)
        settings.addLayout(voice_actions)
        self.setup_hint = label(
            "أضف ONNX وONNX.JSON لكل لغة تحتاجها. "
            "للعربية والإنجليزية جهّز نموذجًا عربيًا وآخر إنجليزيًا، أو انقلهما من USB.",
            "setup",
            True,
        )
        settings.addWidget(self.setup_hint)
        speed_heading = QHBoxLayout()
        speed_heading.addWidget(label("سرعة القراءة", "muted"))
        speed_heading.addStretch()
        self.speed_label = label("1.00×")
        self.speed_label.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        speed_heading.addWidget(self.speed_label)
        settings.addLayout(speed_heading)
        self.speed_slider = QSlider(Qt.Orientation.Horizontal)
        self.speed_slider.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        self.speed_slider.setRange(60, 160)
        self.speed_slider.setSingleStep(5)
        self.speed_slider.setPageStep(10)
        self.speed_slider.setAccessibleName("سرعة القراءة")
        self.speed_slider.valueChanged.connect(
            lambda value: self.speed_label.setText(f"{value / 100:.2f}×")
        )
        settings.addWidget(self.speed_slider)
        settings.addWidget(label("فاصل الفقرات · ملّي ثانية", "muted"))
        self.pause_spin = QSpinBox()
        self.pause_spin.setRange(0, 1500)
        self.pause_spin.setSingleStep(50)
        self.pause_spin.setAccessibleName("الفاصل بين الفقرات بالملّي ثانية")
        settings.addWidget(self.pause_spin)
        self.turn_pause_widget = QWidget()
        turn_pause_layout = QVBoxLayout(self.turn_pause_widget)
        turn_pause_layout.setContentsMargins(0, 0, 0, 0)
        turn_pause_layout.addWidget(label("فاصل الردود · ملّي ثانية", "muted"))
        self.turn_pause_spin = QSpinBox()
        self.turn_pause_spin.setRange(0, 2000)
        self.turn_pause_spin.setSingleStep(50)
        self.turn_pause_spin.setAccessibleName("الفاصل بين جملة الشخص ورد الشخص الآخر")
        turn_pause_layout.addWidget(self.turn_pause_spin)
        settings.addWidget(self.turn_pause_widget)
        settings.addWidget(label("صيغة الحفظ", "muted"))
        self.format_combo = combo()
        self.format_combo.addItem("MP3 · ملف مضغوط (192 kbps)", "mp3")
        self.format_combo.addItem("WAV · بدون ضغط", "wav")
        self.format_combo.setAccessibleName("صيغة الملف الصوتي")
        settings.addWidget(self.format_combo)
        settings.addStretch()
        self.guide_button = button("دليل الإعداد والأصوات")
        self.guide_button.clicked.connect(self._open_guide)
        settings.addWidget(self.guide_button)
        columns.addWidget(settings_card, 4)
        root.addLayout(columns, 1)

        board_card, board_layout = card()
        board_layout.addWidget(label("من السكريبت إلى سبورة وصوت · خطوتان", "section"))
        board_layout.addWidget(
            label(
                "1. اكتب السكريبت أعلاه: # لعنوان الدرس و## لكل خطوة، أو افصل الفقرات بسطر فارغ. "
                "تُنشأ سبورة بالقلم بلا حاجة إلى نموذج صوتي. "
                "2. اختر الأصوات وأضفها من النص المحفوظ داخل السبورة، دون إعادة إدخاله. "
                "للغتين استخدم [1]/[2] واختر وضع الحوار.",
                "muted",
                True,
            )
        )
        board_actions = QHBoxLayout()
        self.board_example_button = button("مثال سكريبت سبورة")
        self.board_example_button.clicked.connect(self._board_example)
        self.create_board_button = button("1. توليد السبورة HTML", "primary")
        self.create_board_button.clicked.connect(self.generate_whiteboard)
        self.open_board_button = button("فتح السبورة")
        self.open_board_button.clicked.connect(self._open_whiteboard)
        board_actions.addWidget(self.board_example_button)
        board_actions.addWidget(self.create_board_button)
        board_actions.addWidget(self.open_board_button)
        board_actions.addStretch()
        board_layout.addLayout(board_actions)
        self.board_source_label = label(
            "لم تُنشأ سبورة بعد. الخطوة 1 لا تحتاج صوتًا مثبتًا.", "muted", True
        )
        self.board_source_label.setTextInteractionFlags(
            Qt.TextInteractionFlag.TextSelectableByMouse
        )
        board_layout.addWidget(self.board_source_label)
        board_audio_actions = QHBoxLayout()
        self.choose_board_button = button("اختيار سبورة محفوظة")
        self.choose_board_button.clicked.connect(self._choose_whiteboard)
        self.board_audio_button = button("2. توليد صوت السبورة", "primary")
        self.board_audio_button.clicked.connect(self.generate_whiteboard_audio)
        board_audio_actions.addWidget(self.choose_board_button)
        board_audio_actions.addWidget(self.board_audio_button)
        board_audio_actions.addStretch()
        board_layout.addLayout(board_audio_actions)
        self.appearance_picker = AppearancePicker()
        self.appearance_picker.sentences_requested.connect(self._refresh_appearance_sentences)
        board_layout.addWidget(self.appearance_picker)
        root.addWidget(board_card)

        html_card, html_layout = card()
        html_layout.addWidget(label("أضف الصوت إلى ملف HTML", "section"))
        html_layout.addWidget(
            label(
                "اختر صفحة موثوقة وأدخل السكريبت أعلاه. تُحفظ نسخة جديدة والصوت مضمّن داخلها، "
                "مع تقليل سرعة الصوت وحركات CSS / Web Animations المدعومة. "
                "حركات JavaScript الخاصة قد تحتاج ربطًا مخصصًا.",
                "muted",
                True,
            )
        )
        html_actions = QHBoxLayout()
        self.choose_html_button = button("اختيار ملف HTML")
        self.choose_html_button.clicked.connect(self._choose_html)
        self.html_source_label = label("لم تختر صفحة بعد.", "muted", True)
        self.html_source_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self.clear_html_button = button("إلغاء الاختيار")
        self.clear_html_button.clicked.connect(self._clear_html)
        self.html_export_button = button("توليد صفحة HTML بالصوت", "primary")
        self.html_export_button.clicked.connect(self.generate_html)
        html_actions.addWidget(self.choose_html_button)
        html_actions.addWidget(self.html_source_label, 1)
        html_actions.addWidget(self.clear_html_button)
        html_actions.addWidget(self.html_export_button)
        html_layout.addLayout(html_actions)
        root.addWidget(html_card)

        actions = QHBoxLayout()
        self.generate_button = button("توليد وحفظ الصوت", "primary")
        self.generate_button.setToolTip("Ctrl+Enter")
        self.generate_button.clicked.connect(self.generate)
        self.preview_button = button("معاينة أول 400 حرف")
        self.preview_button.clicked.connect(self.preview)
        self.cancel_button = button("إلغاء العملية", "cancel")
        self.cancel_button.clicked.connect(self._cancel)
        self.cancel_button.hide()
        actions.addWidget(self.generate_button, 2)
        actions.addWidget(self.preview_button)
        actions.addWidget(self.cancel_button)
        root.addLayout(actions)
        self.progress = QProgressBar()
        self.progress.hide()
        root.addWidget(self.progress)
        self.status = label("اكتب سكريبتًا لإنشاء سبورة، أو أضف نموذجًا لتوليد الصوت.", "muted", True)
        self.status.setAccessibleName("حالة العملية")
        root.addWidget(self.status)

        player_card, player_layout = card()
        player_header = QHBoxLayout()
        self.player_title = label("الاستماع إلى النتيجة", "section")
        player_header.addWidget(self.player_title)
        player_header.addStretch()
        self.open_folder_button = button("فتح مجلد الملف")
        self.open_folder_button.setEnabled(False)
        self.open_folder_button.clicked.connect(self._open_result_folder)
        player_header.addWidget(self.open_folder_button)
        self.open_html_button = button("فتح صفحة HTML الناتجة")
        self.open_html_button.setEnabled(False)
        self.open_html_button.clicked.connect(self._open_html_result)
        player_header.addWidget(self.open_html_button)
        player_layout.addLayout(player_header)
        transport = QHBoxLayout()
        self.play_button = button("تشغيل")
        self.play_button.setEnabled(False)
        self.play_button.clicked.connect(self._toggle_play)
        self.seek_slider = QSlider(Qt.Orientation.Horizontal)
        self.seek_slider.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        self.seek_slider.setRange(0, 0)
        self.seek_slider.setAccessibleName("موضع الاستماع")
        self.seek_slider.setEnabled(False)
        self.player_time = label("00:00 / 00:00", "muted")
        self.player_time.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        transport.addWidget(self.play_button)
        transport.addWidget(self.seek_slider, 1)
        transport.addWidget(self.player_time)
        player_layout.addLayout(transport)
        self.result_path = label("لا توجد نتيجة بعد. جرّب معاينة قصيرة أولًا.", "muted", True)
        self.result_path.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        player_layout.addWidget(self.result_path)
        root.addWidget(player_card)

    def _build_player(self) -> None:
        self.audio_output = QAudioOutput(self)
        self.audio_output.setVolume(1.0)
        self.player = QMediaPlayer(self)
        self.player.setAudioOutput(self.audio_output)
        self.seek_slider.sliderMoved.connect(self.player.setPosition)
        self.player.positionChanged.connect(self._position_changed)
        self.player.durationChanged.connect(self._duration_changed)
        self.player.playbackStateChanged.connect(self._playback_changed)
        self.player.errorOccurred.connect(self._playback_error)

    def _restore_preferences(self) -> None:
        self.speed_slider.setValue(round(self.preferences.speed * 100))
        self.pause_spin.setValue(self.preferences.pause_ms)
        self.format_combo.setCurrentIndex(1 if self.preferences.audio_format == "wav" else 0)
        self.turn_pause_spin.setValue(self.preferences.turn_pause_ms)
        self.primary_voice.restore(
            self.preferences.language, self.preferences.voice_path, self.preferences.speaker_id
        )
        self.secondary_voice.restore(
            self.preferences.second_language,
            self.preferences.second_voice_path,
            self.preferences.second_speaker_id,
        )
        self.mode_combo.setCurrentIndex(1 if self.preferences.mode == "dialogue" else 0)
        self._mode_changed()

    def _shortcuts(self) -> None:
        for shortcut, callback in (
            ("Ctrl+Return", self.generate),
            ("Ctrl+O", self._import_text),
            ("Ctrl+1", lambda: self._tag_paragraph(1)),
            ("Ctrl+2", lambda: self._tag_paragraph(2)),
        ):
            action = QAction(self)
            action.setShortcut(QKeySequence(shortcut))
            action.triggered.connect(callback)
            self.addAction(action)

    def dialogue_mode(self) -> bool:
        return self.mode_combo.currentData() == "dialogue"

    def _mode_changed(self, *_args) -> None:
        dialogue = self.dialogue_mode()
        self.dialogue_toolbar.setVisible(dialogue)
        self.dialogue_hint.setVisible(dialogue)
        self.voice_tabs.setTabVisible(1, dialogue)
        if not dialogue:
            self.voice_tabs.setCurrentIndex(0)
        self.voice_tabs.setTabText(0, "الصوت 1" if dialogue else "الراوي")
        self.primary_voice.title.setText("الصوت الأول · [1]" if dialogue else "الراوي")
        self.turn_pause_widget.setVisible(dialogue)
        self.editor.setPlaceholderText(
            BILINGUAL_EXAMPLE
            if dialogue
            else "اكتب أو الصق السكريبت هنا…\nType or paste your script here…\n\n"
            "اختر نموذجًا يطابق لغة النص قبل التوليد."
        )
        self._update_text_stats()

    def _tag_paragraph(self, speaker: int) -> None:
        if self.worker:
            return
        self.mode_combo.setCurrentIndex(1)
        cursor = self.editor.textCursor()
        if cursor.hasSelection():
            cursor.setPosition(cursor.selectionStart())
        cursor.movePosition(QTextCursor.MoveOperation.StartOfBlock)
        cursor.movePosition(QTextCursor.MoveOperation.EndOfBlock, QTextCursor.MoveMode.KeepAnchor)
        try:
            tagged = tag_line(cursor.selectedText(), speaker)
        except ScriptError as error:
            QMessageBox.warning(self, "راجع وسوم الفقرة", str(error))
            return
        cursor.beginEditBlock()
        cursor.insertText(tagged)
        cursor.endEditBlock()
        self.editor.setTextCursor(cursor)
        self.editor.setFocus()

    def _dialogue_example(self) -> None:
        if self.worker:
            return
        if (
            self.editor.toPlainText().strip()
            and QMessageBox.question(
                self,
                "إدراج مثال الحوار",
                "سيستبدل المثال النص الحالي. هل تريد المتابعة؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        self.mode_combo.setCurrentIndex(1)
        self.editor.setPlainText(BILINGUAL_EXAMPLE)

    def selected_voice(self) -> VoiceSpec | None:
        return self.primary_voice.selected_voice()

    def _cast(self) -> dict[int, DialogueVoice]:
        return {
            role: DialogueVoice(voice, picker.speaker_id())
            for role, picker in ((1, self.primary_voice), (2, self.secondary_voice))
            if (voice := picker.selected_voice()) is not None
        }

    def refresh_voices(self, select_path: str = "") -> None:
        if self.worker:
            return
        self.voices, warnings = self.library.scan()
        self.primary_voice.set_voices(self.voices, select_path)
        self.secondary_voice.set_voices(self.voices)
        self.setup_hint.setVisible(not self.voices)
        if warnings:
            self.status.setText(f"تم تجاهل {len(warnings)} نموذج غير مكتمل أو غير متوافق.")
            self.status.setToolTip("\n".join(warnings[:10]))
        else:
            self.status.setToolTip("")
        self._update_buttons()

    def _update_text_stats(self) -> None:
        text = self.editor.toPlainText()
        self.appearance_picker.invalidate_rows()
        self.text_stats.setText(
            f"{len(text):,} / {MAX_CHARACTERS:,} حرف   ·   {len(text.split()):,} كلمة"
        )
        self._update_buttons()

    def _update_buttons(self) -> None:
        busy = self.worker is not None
        text = self.editor.toPlainText()
        required = {1}
        if self.dialogue_mode():
            try:
                required = {turn.speaker for turn in parse_dialogue(text)}
            except ScriptError:
                required = {1, 2}
        ready = required.issubset(self._cast()) and 0 < len(text.strip()) <= MAX_CHARACTERS
        self.generate_button.setEnabled(not busy and ready)
        self.preview_button.setEnabled(not busy and ready)
        self.html_export_button.setEnabled(not busy and ready and self._html_source is not None)
        self.clear_html_button.setEnabled(not busy and self._html_source is not None)
        self.create_board_button.setEnabled(not busy and 0 < len(text.strip()) <= MAX_CHARACTERS)
        self.open_board_button.setEnabled(not busy and self._board_open_file is not None)
        board_ready = self._board_lesson is not None and self._board_lesson.speakers.issubset(
            self._cast()
        )
        self.board_audio_button.setEnabled(not busy and board_ready)
        if self._board_source and self._board_lesson:
            changed = bool(text.strip()) and text.strip() != self._board_lesson.script
            note = (
                " · السكريبت الحالي مختلف؛ الخطوة 2 تستخدم النص المحفوظ في هذه السبورة. "
                "أعد الخطوة 1 لتطبيق تعديلات النص."
                if changed
                else " · جاهزة لإضافة الصوت من السكريبت المحفوظ داخلها."
            )
            self.board_source_label.setText(
                f"{self._board_source.name} · {len(self._board_lesson.steps)} خطوات" + note
            )
            self.board_source_label.setToolTip(str(self._board_source))
        for widget in (
            self.primary_voice,
            self.choose_html_button,
            self.appearance_picker,
            self.choose_board_button,
            self.board_example_button,
            self.secondary_voice,
            self.mode_combo,
            self.turn_pause_spin,
            self.dialogue_toolbar,
            self.add_voice_button,
            self.refresh_button,
            self.speed_slider,
            self.pause_spin,
            self.format_combo,
            self.import_text_button,
            self.clear_button,
            self.editor,
        ):
            widget.setEnabled(not busy)
        self.cancel_button.setVisible(busy)
        self.cancel_button.setEnabled(busy and not self._closing)
        self.progress.setVisible(busy)

    def _options(self) -> RenderOptions:
        return RenderOptions(
            speed=self.speed_slider.value() / 100,
            pause_ms=self.pause_spin.value(),
            speaker_id=self.primary_voice.speaker_id(),
        )

    def _input(self) -> tuple[str, dict[int, DialogueVoice]] | None:
        if self.worker:
            return None
        try:
            text = validate_text(self.editor.toPlainText())
            cast = self._cast()
            if self.dialogue_mode():
                validate_dialogue_cast(parse_dialogue(text), cast, self._options())
            else:
                if has_voice_markers(text):
                    raise ScriptError(
                        "السكريبت يحتوي وسوم أصوات. اختر «حوار بين صوتين» حتى لا تُقرأ الوسوم."
                    )
                if 1 not in cast:
                    raise VoiceError("اختر نموذجًا صوتيًا يطابق لغة النص قبل التوليد.")
            return text, cast
        except (ScriptError, VoiceError, AudioError) as error:
            QMessageBox.warning(self, "راجع السكريبت والأصوات", str(error))
            return None

    def _start_audio(
        self, text: str, cast: dict[int, DialogueVoice], path: Path, kind: str
    ) -> None:
        options = self._options()
        dialogue = self.dialogue_mode()
        pause = self.turn_pause_spin.value()

        def task(cancel, progress):
            if dialogue:
                return self.engine.render_dialogue(
                    text, cast, path, options, cancel, progress, turn_pause_ms=pause
                )
            return self.engine.render(text, cast[1].voice, path, options, cancel, progress)

        self._release_player()
        self.open_html_button.setEnabled(False)
        self._start_task(task, kind)

    def generate(self) -> None:
        values = self._input()
        if values is None:
            return
        text, cast = values
        extension = self.format_combo.currentData()
        directory = (
            Path(self.preferences.output_dir) if self.preferences.output_dir else Path.home()
        )
        filename = directory / f"NovaVoice-{datetime.now():%Y%m%d-%H%M%S}.{extension}"
        chosen, _ = QFileDialog.getSaveFileName(
            self, "حفظ الملف الصوتي", str(filename), f"{extension.upper()} (*.{extension})"
        )
        if not chosen:
            return
        path = Path(chosen)
        if path.suffix.lower() != f".{extension}":
            path = Path(f"{path}.{extension}")
            # The native dialog confirmed the original name, not this appended name.
            if (
                path.exists()
                and QMessageBox.question(self, "استبدال الملف؟", "الملف موجود. هل تريد استبداله؟")
                != QMessageBox.StandardButton.Yes
            ):
                return
        self.preferences.output_dir = str(path.parent)
        self._start_audio(text, cast, path, "render")

    def preview(self) -> None:
        values = self._input()
        if values is None:
            return
        text, cast = values
        self._preview_number += 1
        path = Path(self._preview_directory.name) / f"preview-{self._preview_number}.wav"
        text = preview_dialogue(text) if self.dialogue_mode() else preview_text(text)
        self._start_audio(text, cast, path, "preview")

    def _board_example(self) -> None:
        if self.worker:
            return
        if (
            self.editor.toPlainText().strip()
            and QMessageBox.question(
                self,
                "مثال السبورة",
                "سيستبدل المثال النص الحالي. هل تريد المتابعة؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        self.mode_combo.setCurrentIndex(1)
        self.editor.setPlainText(WHITEBOARD_EXAMPLE)

    def _board_save_path(self, title: str, suggested: Path) -> Path | None:
        chosen, _ = QFileDialog.getSaveFileName(self, title, str(suggested), "HTML (*.html *.htm)")
        if not chosen:
            return None
        path = Path(chosen)
        if path.suffix.lower() not in (".html", ".htm"):
            path = Path(str(path) + ".html")
            if (
                path.exists()
                and QMessageBox.question(self, "استبدال الملف؟", "الملف موجود. هل تريد استبداله؟")
                != QMessageBox.StandardButton.Yes
            ):
                return None
        return path

    def _refresh_appearance_sentences(self) -> None:
        if self.worker:
            return
        try:
            lesson = parse_lesson(self.editor.toPlainText(), dialogue=self.dialogue_mode())
        except ScriptError as error:
            QMessageBox.warning(self, "راجع السكريبت قبل اختيار ألوان الجمل", str(error))
            return
        self.appearance_picker.set_rows(lesson)

    def generate_whiteboard(self) -> None:
        if self.worker:
            return
        try:
            lesson = parse_lesson(self.editor.toPlainText(), dialogue=self.dialogue_mode())
        except ScriptError as error:
            QMessageBox.warning(self, "راجع سكريبت السبورة", str(error))
            return
        directory = (
            Path(self.preferences.output_dir) if self.preferences.output_dir else Path.home()
        )
        path = self._board_save_path(
            "الخطوة 1 · حفظ السبورة بلا صوت",
            directory / f"NovaLesson-{datetime.now():%Y%m%d-%H%M%S}.html",
        )
        if path is None:
            return
        self.preferences.output_dir = str(path.parent)
        appearance = self.appearance_picker.snapshot(lesson)
        self._release_player()
        self._start_task(
            lambda cancel, progress: save_whiteboard(
                lesson, path, cancel, progress, appearance=appearance
            ),
            "whiteboard",
        )

    def _choose_whiteboard(self) -> None:
        if self.worker:
            return
        selected, _ = QFileDialog.getOpenFileName(
            self, "اختيار سبورة Nova بلا صوت", "", "HTML (*.html *.htm)"
        )
        if not selected:
            return
        try:
            board = WhiteboardPage.load(Path(selected))
        except (OSError, HtmlExportError, ScriptError) as error:
            QMessageBox.warning(self, "تعذّر فتح السبورة", str(error))
            return
        self._board_source = board.page.source
        self._board_lesson = board.lesson
        self._board_open_file = board.page.source
        self.mode_combo.setCurrentIndex(1 if board.lesson.dialogue else 0)
        self.appearance_picker.restore(board.appearance, board.lesson)
        self._update_buttons()

    def generate_whiteboard_audio(self) -> None:
        if self.worker or self._board_source is None:
            return
        try:
            board = WhiteboardPage.load(self._board_source)
            cast = self._cast()
            options = self._options()
            validate_lesson_cast(board.lesson, cast, options)
        except (OSError, HtmlExportError, ScriptError, VoiceError, AudioError) as error:
            QMessageBox.warning(self, "راجع السبورة والأصوات", str(error))
            return
        current_text = self.editor.toPlainText().strip()
        if (
            current_text
            and current_text != board.lesson.script
            and QMessageBox.question(
                self,
                "الصوت من السبورة المحفوظة",
                "السكريبت الحالي مختلف عن النص الذي أُنشئت منه السبورة. "
                "أعد الخطوة 1 لتحديثها، أو تابع لتوليد الصوت من النص المحفوظ داخلها. "
                "هل تريد المتابعة؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        source = board.page.source
        path = self._board_save_path(
            "الخطوة 2 · حفظ نسخة السبورة بالصوت", source.with_name(source.stem + "-with-voice.html")
        )
        if path is None:
            return
        try:
            validate_destination(source, path)
        except (OSError, HtmlExportError) as error:
            QMessageBox.warning(self, "اختر اسمًا آخر", str(error))
            return
        pause, audio_format = self.turn_pause_spin.value(), self.format_combo.currentData()
        self._release_player()
        self.open_html_button.setEnabled(False)
        self._start_task(
            lambda cancel, progress: render_whiteboard_audio(
                self.engine,
                source,
                cast,
                path,
                options,
                cancel,
                progress,
                turn_pause_ms=pause,
                audio_format=audio_format,
            ),
            "whiteboard-audio",
        )

    def _open_whiteboard(self) -> None:
        if self._board_open_file and not QDesktopServices.openUrl(
            QUrl.fromLocalFile(str(self._board_open_file))
        ):
            QMessageBox.information(
                self, "فتح السبورة", "افتح ملف HTML الناتج يدويًا في متصفح حديث."
            )

    def _choose_html(self) -> None:
        if self.worker:
            return
        selected, _ = QFileDialog.getOpenFileName(
            self, "اختيار ملف HTML الأصلي", "", "HTML (*.html *.htm)"
        )
        if not selected:
            return
        path = Path(selected)
        try:
            if path.stat().st_size > MAX_HTML_BYTES:
                raise HtmlExportError("ملف HTML أكبر من 25 ميغابايت.")
        except (OSError, HtmlExportError) as error:
            QMessageBox.warning(self, "تعذّر اختيار الصفحة", str(error))
            return
        self._html_source = path
        self.html_source_label.setText(path.name)
        self.html_source_label.setToolTip(str(path))
        self._update_buttons()

    def _clear_html(self) -> None:
        if self.worker:
            return
        self._html_source = None
        self.html_source_label.setText("لم تختر صفحة بعد.")
        self.html_source_label.setToolTip("")
        self._update_buttons()

    def generate_html(self) -> None:
        values = self._input()
        if values is None:
            return
        source = self._html_source
        if source is None:
            QMessageBox.information(self, "اختر الصفحة", "اختر ملف HTML الأصلي أولًا.")
            return
        text, cast = values
        suggested = source.with_name(source.stem + "-with-voice.html")
        chosen, _ = QFileDialog.getSaveFileName(
            self, "حفظ نسخة HTML بالصوت", str(suggested), "HTML (*.html *.htm)"
        )
        if not chosen:
            return
        path = Path(chosen)
        if path.suffix.lower() not in (".html", ".htm"):
            path = Path(str(path) + ".html")
            if (
                path.exists()
                and QMessageBox.question(
                    self, "استبدال نسخة سابقة؟", "الملف الناتج موجود. هل تريد استبداله؟"
                )
                != QMessageBox.StandardButton.Yes
            ):
                return
        try:
            validate_destination(source, path)
        except (OSError, HtmlExportError) as error:
            QMessageBox.warning(self, "اختر اسمًا آخر", str(error))
            return
        if (
            path.parent.resolve() != source.parent.resolve()
            and QMessageBox.question(
                self,
                "ملفات الصفحة المرتبطة",
                "يفضّل حفظ النسخة بجانب الصفحة الأصلية حتى تعمل الصور والملفات النسبية. "
                "الصوت فقط مضمّن؛ لن تُنسخ ملفات الصفحة الأخرى. هل تريد الحفظ هنا رغم ذلك؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        options = self._options()
        dialogue = self.dialogue_mode()
        pause = self.turn_pause_spin.value()
        audio_format = self.format_combo.currentData()

        def task(cancel, progress):
            return render_html(
                self.engine,
                source,
                text,
                cast,
                path,
                options,
                cancel,
                progress,
                dialogue=dialogue,
                turn_pause_ms=pause,
                audio_format=audio_format,
            )

        self._release_player()
        self.open_html_button.setEnabled(False)
        self._start_task(task, "html")

    def _open_html_result(self) -> None:
        if self._html_result_file and not QDesktopServices.openUrl(
            QUrl.fromLocalFile(str(self._html_result_file))
        ):
            QMessageBox.information(self, "فتح الصفحة", "افتح ملف HTML الناتج يدويًا في متصفح حديث.")

    def _start_task(self, task, kind: str) -> None:
        self._progress_kind = kind
        self.worker = TaskWorker(task, self)
        self.worker.progress.connect(self._task_progress)
        self.worker.succeeded.connect(self._task_success)
        self.worker.failed.connect(self._task_error)
        self.worker.cancelled.connect(self._task_cancelled)
        self.worker.finished.connect(self._task_finished)
        messages = {
            "import": "جارٍ استيراد النموذج…",
            "html": "جارٍ تجهيز الصفحة وتوليد الصوت محليًا…",
            "whiteboard": "جارٍ تحويل السكريبت إلى سبورة HTML محليًا…",
            "whiteboard-audio": "جارٍ توليد مقطع صوتي لكل خطوة من السبورة…",
        }
        self.status.setText(messages.get(kind, "جارٍ تجهيز المحرك المحلي…"))
        self.progress.setRange(0, 0)
        self._update_buttons()
        self.worker.start()

    def _task_progress(self, value: int) -> None:
        if value < 0:
            self.progress.setRange(0, 0)
        else:
            self.progress.setRange(0, 100)
            self.progress.setValue(value)
            if self.worker and not self.worker.cancel_event.is_set():
                if self._progress_kind in ("html", "whiteboard-audio"):
                    stage = "حفظ الصوت داخل HTML" if value >= 85 else "توليد صوت الصفحة"
                    self.status.setText(f"جارٍ {stage} محليًا… {value}%")
                elif self._progress_kind == "whiteboard":
                    self.status.setText(f"جارٍ إنشاء ملف السبورة… {value}%")
                else:
                    self.status.setText(
                        "جارٍ استيراد النموذج…"
                        if self._progress_kind == "import"
                        else f"جارٍ توليد الصوت على جهازك… {value}%"
                    )

    def _task_success(self, result: Any) -> None:
        if self._closing:
            return
        if self._progress_kind == "import":
            self.status.setText("تمت إضافة النموذج. اكتب السكريبت لتجربة الصوت.")
            return
        if isinstance(result, WhiteboardResult):
            self.appearance_picker.restore(result.appearance, result.lesson)
            self._board_source = result.path
            self._board_lesson = result.lesson
            self._board_open_file = result.path
            self._result_file = result.path
            self._html_result_file = result.path
            self.player_title.setText("الخطوة 1 اكتملت · السبورة جاهزة بلا صوت")
            self.result_path.setText(str(result.path))
            self.status.setText(
                f"تم إنشاء {len(result.lesson.steps)} خطوات. افتح السبورة لمراجعتها، "
                "ثم اختر الأصوات واضغط «2. توليد صوت السبورة»."
            )
            self.open_folder_button.setEnabled(True)
            self.open_html_button.setEnabled(True)
            return
        if isinstance(result, HtmlAudioResult):
            if self._progress_kind == "whiteboard-audio":
                self._board_open_file = result.path
            self._result_file = result.path
            self._html_result_file = result.path
            self.player_title.setText("صفحة HTML الصوتية جاهزة")
            self.result_path.setText(str(result.path))
            message = (
                "اكتملت الخطوة 2: نسخة السبورة بالصوت لكل خطوة جاهزة. "
                "افتحها للتحكم بالصوت والكتابة. "
                if self._progress_kind == "whiteboard-audio"
                else "تم حفظ نسخة HTML جديدة والصوت داخلها. افتحها للتحكم بالسرعة. "
            )
            self.status.setText(
                message + f"مدة الصوت {clock(round(result.duration_seconds * 1000))}."
            )
            self.open_folder_button.setEnabled(True)
            self.open_html_button.setEnabled(True)
            return
        result: RenderResult
        preview = self._progress_kind == "preview"
        self.status.setText(
            f"اكتمل {'إعداد المعاينة' if preview else 'حفظ الصوت'} · "
            f"المدة {clock(round(result.duration_seconds * 1000))}"
        )
        self.player_title.setText("معاينة قصيرة · أول 400 حرف" if preview else "ملفك الصوتي جاهز")
        if preview:
            self.open_folder_button.setEnabled(False)
            self.result_path.setText(
                "هذه معاينة مؤقتة. اضغط «توليد وحفظ الصوت» لتصدير السكريبت كاملًا."
            )
        else:
            self._result_file = result.path
            self.result_path.setText(str(result.path))
            self.open_folder_button.setEnabled(True)
        self.player.setSource(QUrl.fromLocalFile(str(result.path)))
        for old_preview in Path(self._preview_directory.name).glob("*.wav"):
            if old_preview != result.path:
                try:
                    old_preview.unlink(missing_ok=True)
                except OSError:
                    pass  # The media backend may still be releasing its handle.
        self.play_button.setEnabled(True)
        self.seek_slider.setEnabled(True)
        if preview:
            self.player.play()

    def _task_error(self, message: str) -> None:
        self.status.setText("لم تكتمل العملية. لم تتغير الملفات السابقة أو الصفحة الأصلية.")
        if not self._closing:
            QMessageBox.warning(self, "تعذّر إتمام العملية", message)

    def _task_cancelled(self) -> None:
        self.status.setText("تم الإلغاء. لم يتم استبدال أي ملف سابق أو الصفحة الأصلية.")

    def _task_finished(self) -> None:
        worker = self.worker
        self.worker = None
        if worker:
            worker.deleteLater()
        if self._progress_kind == "import":
            self.refresh_voices()
        self._update_buttons()
        if self._closing:
            self.close()

    def _cancel(self) -> None:
        if self.worker:
            self.worker.cancel_event.set()
            self.cancel_button.setEnabled(False)
            self.status.setText(
                "جارٍ الإلغاء… قد يلزم انتظار اكتمال المقطع الحالي أو تحميل النموذج."
            )

    def _import_text(self) -> None:
        if self.worker:
            return
        filename, _ = QFileDialog.getOpenFileName(self, "استيراد سكريبت", "", "Text (*.txt)")
        if not filename:
            return
        try:
            text = read_script(Path(filename))
        except (OSError, ScriptError) as error:
            QMessageBox.warning(self, "تعذّر فتح السكريبت", str(error))
            return
        if (
            self.editor.toPlainText().strip()
            and QMessageBox.question(
                self, "استبدال النص؟", "سيتم استبدال النص الحالي بمحتوى الملف. هل تريد المتابعة؟"
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        self.editor.setPlainText(text)

    def _clear_text(self) -> None:
        if self.worker or not self.editor.toPlainText():
            return
        if (
            QMessageBox.question(self, "مسح السكريبت", "هل تريد مسح النص الحالي؟")
            == QMessageBox.StandardButton.Yes
        ):
            self.editor.clear()

    def _import_voice(self) -> None:
        if self.worker:
            return
        filename, _ = QFileDialog.getOpenFileName(
            self, "اختر نموذج Piper", "", "Piper model (*.onnx)"
        )
        if not filename:
            return
        model = Path(filename)
        config = Path(f"{model}.json")
        if not config.is_file():
            selected, _ = QFileDialog.getOpenFileName(
                self,
                "اختر ملف JSON المطابق لهذا النموذج",
                str(model.parent),
                "Piper config (*.json)",
            )
            if not selected:
                return
            config = Path(selected)
        self._start_task(
            lambda cancel, progress: self.library.import_voice(model, config, cancel, progress),
            "import",
        )

    def _release_player(self) -> None:
        self.player.stop()
        self.player.setSource(QUrl())
        self.play_button.setEnabled(False)
        self.seek_slider.setEnabled(False)

    def _toggle_play(self) -> None:
        if self.player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.player.pause()
        else:
            if self.player.mediaStatus() == QMediaPlayer.MediaStatus.EndOfMedia:
                self.player.setPosition(0)
            self.player.play()

    def _playback_changed(self, state) -> None:
        playing = state == QMediaPlayer.PlaybackState.PlayingState
        self.play_button.setText("إيقاف مؤقت" if playing else "تشغيل")
        icon = (
            QStyle.StandardPixmap.SP_MediaPause if playing else QStyle.StandardPixmap.SP_MediaPlay
        )
        self.play_button.setIcon(self.style().standardIcon(icon))

    def _position_changed(self, value: int) -> None:
        if not self.seek_slider.isSliderDown():
            self.seek_slider.setValue(value)
        self.player_time.setText(f"{clock(value)} / {clock(self.player.duration())}")

    def _duration_changed(self, duration: int) -> None:
        self.seek_slider.setRange(0, duration)
        self._position_changed(self.player.position())

    def _playback_error(self, *_args) -> None:
        self.status.setText("تعذّرت المعاينة. إن تم حفظ الملف، يمكنك فتحه بمشغّل الصوت في Windows.")
        self.play_button.setEnabled(False)
        self.seek_slider.setEnabled(False)

    def _open_result_folder(self) -> None:
        if self._result_file:
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(self._result_file.parent)))

    def _open_guide(self) -> None:
        guide = resource_dir() / "START-HERE.txt"
        if not guide.is_file() or not QDesktopServices.openUrl(QUrl.fromLocalFile(str(guide))):
            QMessageBox.information(
                self,
                "الإعداد الأولي",
                "شغّل Setup-Windows.bat لتثبيت المتطلبات، "
                "ثم Download-Arabic-Voice.bat أو Download-English-Voice.bat "
                "لتنزيل الأصوات مرة واحدة. "
                "إذا كان الجهاز غير متصل، انقل نموذج ONNX وملف JSON من جهاز آخر، "
                "ثم اضغط «إضافة نموذج».",
            )

    def _about(self) -> None:
        QMessageBox.about(
            self,
            "حول Nova Voice",
            f"Nova Voice {__version__}\nتحويل النص إلى صوت محليًا باستخدام Piper.\n\n"
            "لا يتم إرسال النص أو الصوت إلى خادم، ولا يُحفظ السكريبت تلقائيًا.\n"
            "الأصوات تعتمد على النماذج المثبتة؛ لا يتضمن التطبيق استنساخ الأصوات.\n\n"
            "هذا التطبيق الفرعي مرخص تحت GPL-3.0-or-later، دون أي ضمان. "
            "يسمح بإعادة توزيعه وتعديله وفق الترخيص. راجع LICENSE وTHIRD_PARTY.md بجانب البرنامج. "
            "لكل نموذج صوتي ترخيص مستقل موضح في MODEL_CARD.",
        )

    def cleanup(self) -> None:
        if self._cleanup_done:
            return
        self._cleanup_done = True
        self._release_player()
        voice = self.selected_voice()
        self.preferences.voice_path = str(voice.model_path) if voice else ""
        second = self.secondary_voice.selected_voice()
        self.preferences.second_voice_path = str(second.model_path) if second else ""
        self.preferences.language = self.primary_voice.language()
        self.preferences.second_language = self.secondary_voice.language()
        self.preferences.speaker_id = self.primary_voice.speaker_id()
        self.preferences.second_speaker_id = self.secondary_voice.speaker_id()
        self.preferences.mode = self.mode_combo.currentData()
        self.preferences.turn_pause_ms = self.turn_pause_spin.value()
        self.preferences.speed = self.speed_slider.value() / 100
        self.preferences.pause_ms = self.pause_spin.value()
        self.preferences.audio_format = self.format_combo.currentData()
        try:
            save_preferences(self.data_dir, self.preferences)
        except OSError:
            logging.getLogger(__name__).warning("Could not save local preferences")
        try:
            self._preview_directory.cleanup()
        except OSError:
            logging.getLogger(__name__).warning("Could not remove temporary preview directory")

    def closeEvent(self, event: QCloseEvent) -> None:
        if self.worker:
            event.ignore()
            if self._closing:
                return
            if (
                QMessageBox.question(
                    self, "يوجد تحويل جارٍ", "هل تريد إلغاء العملية وإغلاق البرنامج بعد توقفها؟"
                )
                == QMessageBox.StandardButton.Yes
            ):
                self._closing = True
                self._cancel()
            return
        self.cleanup()
        event.accept()
