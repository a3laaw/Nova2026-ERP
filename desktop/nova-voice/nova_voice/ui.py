"""Arabic-first Windows desktop interface. No servers or browser dependencies."""

import logging
import tempfile
from dataclasses import replace
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from typing import Any

from PySide6.QtCore import Qt, QUrl
from PySide6.QtGui import QAction, QCloseEvent, QDesktopServices, QIcon, QKeySequence, QTextCursor
from PySide6.QtMultimedia import QAudioOutput, QMediaPlayer
from PySide6.QtWidgets import (
    QApplication,
    QDialog,
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QProgressBar,
    QProgressDialog,
    QScrollArea,
    QSlider,
    QSpinBox,
    QStyle,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from . import __version__
from .appearance import AppearanceError
from .appearance_picker import AppearancePicker
from .azure_picker import AzureConsentDialog, AzurePicker
from .azure_speech import AzureError, AzureJob, AzurePlan, CloudRequest
from .controls import Disclosure, button, card, clock, combo, label
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
from .inference_picker import InferencePicker
from .lesson_draft import LessonDraft
from .lesson_library import LessonLibrary, LibraryError, LibraryMetadata
from .lesson_picker import LessonPicker, LessonRequest
from .lesson_planner import request_lesson
from .library_picker import LibraryPanel, LibrarySaveDialog
from .scene_examples import VISUAL_EXAMPLE, example_plan
from .scene_picker import AssetRequest, PlannerRequest, ScenePicker
from .scene_planner import request_plan
from .scene_revision import RevisionRequest, RevisionResult, revise_plan
from .scenes import SceneError, VisualPlan
from .secondary_assets import AssetPreparation, prepare_plan
from .storage import (
    application_dir,
    load_preferences,
    resource_dir,
    save_preferences,
    user_data_dir,
)
from .text import MAX_CHARACTERS, ScriptError, preview_text, read_script, validate_text
from .theme import STYLESHEET
from .video import VideoResult, convert_video
from .video_export import LessonVideoExporter, is_exportable_main
from .video_picker import ConversionRequest, VideoPicker
from .voice_picker import VoicePicker
from .voices import VoiceError, VoiceLibrary, VoiceSpec
from .whiteboard import (
    WHITEBOARD_EXAMPLE,
    Lesson,
    WhiteboardPage,
    WhiteboardResult,
    parse_lesson,
    render_whiteboard_audio,
    render_whiteboard_with_audio,
    save_whiteboard,
    validate_lesson_cast,
    whiteboard_cloud_requests,
)
from .worker import TaskWorker


class MainWindow(QMainWindow):
    def __init__(self, data_dir: Path | None = None):
        super().__init__()
        self.data_dir = data_dir or user_data_dir()
        self.preferences = load_preferences(self.data_dir)
        self.library = VoiceLibrary(self.data_dir / "voices", application_dir() / "voices")
        self.lesson_library = LessonLibrary(self.data_dir / "library")
        self._editing_entry_id: int | None = None
        self._library_last_meta = LibraryMetadata()
        self.engine = SpeechEngine()
        self._active_azure_job: AzureJob | None = None
        self.voices: list[VoiceSpec] = []
        self.worker: TaskWorker | None = None
        self._closing = False
        self._adopted_draft: LessonDraft | None = None
        self._adopted_revision = -1
        self._asset_request: AssetRequest | None = None
        self._revision_request: RevisionRequest | None = None
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
        self.provider_combo.currentIndexChanged.connect(self._provider_changed)
        self.azure_picker.changed.connect(self._update_buttons)
        self.azure_picker.forgotten.connect(self._azure_forgotten)
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
        host = QWidget()
        outer = QVBoxLayout(host)
        outer.setContentsMargins(16, 0, 16, 12)
        outer.setSpacing(10)
        outer.addWidget(scroll, 1)
        self.setCentralWidget(host)

        heading = QHBoxLayout()
        titles = QVBoxLayout()
        titles.setSpacing(5)
        titles.addWidget(label("Nova Voice", "title"))
        titles.addWidget(label("اكتب النص، اختر الأصوات، ثم أنشئ درسك في ملف واحد.", "muted"))
        heading.addLayout(titles)
        heading.addStretch()
        self.privacy_badge = label("محلي · الاقتراح الشبكي اختياري", "privacy")
        heading.addWidget(self.privacy_badge)
        about = button("حول البرنامج")
        about.clicked.connect(self._about)
        heading.addWidget(about)
        root.addLayout(heading)

        self.workspace_tabs = QTabWidget()
        self.workspace_tabs.setAccessibleName("أقسام إعداد الدرس والتصدير")
        self.workspace_tabs.setDocumentMode(True)
        root.addWidget(self.workspace_tabs)
        input_page = QWidget()
        input_layout = QVBoxLayout(input_page)
        input_layout.setContentsMargins(0, 16, 0, 0)
        columns = QHBoxLayout()
        columns.setSpacing(18)
        editor_card, editor_layout = card()
        editor_header = QHBoxLayout()
        editor_header.addWidget(label("1 · اكتب نص الدرس", "section"))
        editor_header.addStretch()
        self.import_text_button = button("استيراد TXT")
        self.import_text_button.clicked.connect(self._import_text)
        self.clear_button = button("مسح")
        self.clear_button.clicked.connect(self._clear_text)
        editor_header.addWidget(self.import_text_button)
        editor_header.addWidget(self.clear_button)
        editor_layout.addLayout(editor_header)
        self.board_example_button = button("مثال سكريبت سبورة")
        self.board_example_button.clicked.connect(self._board_example)
        editor_layout.addWidget(self.board_example_button)
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
                "النص لا يُرسل أو يُحفظ تلقائيًا. الاقتراح الشبكي وصوت Azure اختياريان بإذن صريح. "
                "يمكن تشكيل الكلمات العربية الملتبسة لتحسين النطق.",
                "muted",
                True,
            )
        )
        columns.addWidget(editor_card, 7)

        settings_card, settings = card()
        settings_card.setMinimumWidth(310)
        settings_card.setMaximumWidth(410)
        settings.addWidget(label("2 · اختر الأصوات", "section"))
        self.provider_combo = combo()
        self.provider_combo.setAccessibleName("محرك الصوت: محلي أو Azure اختياري")
        self.provider_combo.addItem("Piper / كريم · محلي دون إنترنت", "local")
        self.provider_combo.addItem("Azure Speech · سحابي بإذن لكل عملية", "azure")
        settings.addWidget(self.provider_combo)
        self.azure_picker = AzurePicker()
        self.azure_picker.hide()
        settings.addWidget(self.azure_picker)
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
        self.voice_tuning = Disclosure("إعدادات إضافية · سرعة القراءة والفواصل")
        tuning = self.voice_tuning.content_layout
        speed_heading = QHBoxLayout()
        speed_heading.addWidget(label("سرعة القراءة", "muted"))
        speed_heading.addStretch()
        self.speed_label = label("1.00×")
        self.speed_label.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        speed_heading.addWidget(self.speed_label)
        tuning.addLayout(speed_heading)
        self.speed_slider = QSlider(Qt.Orientation.Horizontal)
        self.speed_slider.setLayoutDirection(Qt.LayoutDirection.LeftToRight)
        self.speed_slider.setRange(60, 160)
        self.speed_slider.setSingleStep(5)
        self.speed_slider.setPageStep(10)
        self.speed_slider.setAccessibleName("سرعة القراءة")
        self.speed_slider.valueChanged.connect(
            lambda value: self.speed_label.setText(f"{value / 100:.2f}×")
        )
        tuning.addWidget(self.speed_slider)
        tuning.addWidget(label("فاصل الفقرات · ملّي ثانية", "muted"))
        self.pause_spin = QSpinBox()
        self.pause_spin.setRange(0, 1500)
        self.pause_spin.setSingleStep(50)
        self.pause_spin.setAccessibleName("الفاصل بين الفقرات بالملّي ثانية")
        tuning.addWidget(self.pause_spin)
        self.turn_pause_widget = QWidget()
        turn_pause_layout = QVBoxLayout(self.turn_pause_widget)
        turn_pause_layout.setContentsMargins(0, 0, 0, 0)
        turn_pause_layout.addWidget(label("فاصل الردود · ملّي ثانية", "muted"))
        self.turn_pause_spin = QSpinBox()
        self.turn_pause_spin.setRange(0, 2000)
        self.turn_pause_spin.setSingleStep(50)
        self.turn_pause_spin.setAccessibleName("الفاصل بين جملة الشخص ورد الشخص الآخر")
        turn_pause_layout.addWidget(self.turn_pause_spin)
        tuning.addWidget(self.turn_pause_widget)
        settings.addWidget(label("صيغة الحفظ", "muted"))
        self.format_combo = combo()
        self.format_combo.addItem("MP3 · ملف مضغوط (192 kbps)", "mp3")
        self.format_combo.addItem("WAV · بدون ضغط", "wav")
        self.format_combo.setAccessibleName("صيغة الملف الصوتي")
        settings.addWidget(self.format_combo)
        settings.addWidget(self.voice_tuning)
        settings.addStretch()
        self.guide_button = button("دليل الإعداد والأصوات")
        self.guide_button.clicked.connect(self._open_guide)
        settings.addWidget(self.guide_button)
        columns.addWidget(settings_card, 4)
        input_layout.addLayout(columns, 1)
        self.scene_section = Disclosure("مشاهد ذكية · اختياري: سكريبت ← مسودة ← مراجعة ← اعتماد")
        self.scene_picker = ScenePicker(
            self._source_lesson,
            plan_adapter=self._bind_story_plan,
            asset_cache=self.data_dir / "secondary-assets-v1",
        )
        self.scene_picker.changed.connect(self._update_buttons)
        self.scene_picker.requested.connect(self._request_scenes)
        self.scene_picker.example_requested.connect(self._scene_example)
        self.scene_picker.assets_requested.connect(self._request_assets)
        self.scene_picker.revision_requested.connect(self._request_revision)
        self.scene_section.content_layout.addWidget(self.scene_picker)
        self.lesson_section = Disclosure("من وصف قصير إلى درس كامل مرسوم · مسودة ومراجعة أولًا")
        self.lesson_picker = LessonPicker(lambda: self.scene_picker.policy.currentData())
        self.lesson_picker.changed.connect(self._update_buttons)
        self.lesson_picker.requested.connect(self._request_lesson)
        self.lesson_picker.adopted.connect(self._adopt_lesson)
        self.lesson_picker.detached.connect(self._detach_lesson)
        self.scene_picker.policy.currentIndexChanged.connect(self.lesson_picker.invalidate)
        self.lesson_section.content_layout.addWidget(self.lesson_picker)
        input_layout.addWidget(self.lesson_section)
        input_layout.addWidget(self.scene_section)
        self.workspace_tabs.addTab(input_page, "النص والأصوات")

        appearance_card, appearance_layout = card()
        appearance_layout.addWidget(label("3 · خصّص سبورتك", "section"))
        appearance_layout.addWidget(
            label(
                "خطوة اختيارية: اختر ترتيب اللغتين والألوان والأطفال، ثم استخدم زر التوليد أدناه. "
                "التخصيص للعرض فقط ولا يغيّر الصوت أو لغته.",
                "muted",
                True,
            )
        )
        self.appearance_picker = AppearancePicker()
        self.appearance_picker.sentences_requested.connect(self._refresh_appearance_sentences)
        appearance_layout.addWidget(self.appearance_picker)
        appearance_layout.addStretch()
        self.workspace_tabs.addTab(appearance_card, "ألوان وشخصيات")

        export_card, export_layout = card()
        export_layout.setContentsMargins(18, 12, 18, 12)
        export_layout.setSpacing(8)
        export_actions = QHBoxLayout()

        board_card, board_layout = card()
        board_layout.addWidget(label("سبورة محفوظة · المسار ذو الخطوتين", "section"))
        board_layout.addWidget(
            label(
                "للمراجعة قبل النطق: أنشئ نسخة صامتة من المحرر بالخطوة 1، ثم اختر الأصوات "
                "من تبويب «النص والأصوات» وأضفها إلى النص المحفوظ في HTML بالخطوة 2. "
                "للحفظ المباشر من المحرر استخدم الزر الموحّد أدناه.",
                "muted",
                True,
            )
        )
        self.combined_board_button = button("توليد السبورة بالنص والصوت معًا", "primary")
        self.combined_board_button.setToolTip(
            "من السكريبت الحالي والأصوات والتخصيصات المختارة إلى HTML واحد؛ "
            "لا تحتاج إنشاء سبورة محفوظة أولًا."
        )
        self.combined_board_button.clicked.connect(self.generate_whiteboard_with_audio)
        export_actions.addWidget(self.combined_board_button, 1)
        board_actions = QHBoxLayout()
        self.create_board_button = button("1. توليد السبورة HTML")
        self.create_board_button.clicked.connect(self.generate_whiteboard)
        self.open_board_button = button("فتح السبورة")
        self.open_board_button.clicked.connect(self._open_whiteboard)
        board_actions.addWidget(self.create_board_button)
        export_actions.addWidget(self.open_board_button)
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
        self.board_audio_button = button("2. توليد صوت السبورة")
        self.board_audio_button.clicked.connect(self.generate_whiteboard_audio)
        board_audio_actions.addWidget(self.choose_board_button)
        board_audio_actions.addWidget(self.board_audio_button)
        board_audio_actions.addStretch()
        board_layout.addLayout(board_audio_actions)
        board_layout.addStretch()
        self.workspace_tabs.addTab(board_card, "سبورة محفوظة")

        other_page = QWidget()
        other_layout = QVBoxLayout(other_page)
        other_layout.setContentsMargins(0, 16, 0, 0)
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
        html_layout.addLayout(html_actions)
        html_layout.addWidget(self.html_export_button)
        other_layout.addWidget(html_card)
        audio_card, audio_layout = card()
        audio_layout.addWidget(label("تصدير صوت فقط · MP3 أو WAV", "section"))
        audio_layout.addWidget(
            label(
                "يستخدم النص والأصوات من التبويب الأول. لهذه الأزرار استخدم سكريبتًا صوتيًا "
                "دون عناوين # و## الخاصة بالسبورة. Ctrl+Enter لحفظ الصوت فقط.",
                "muted",
                True,
            )
        )
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
        audio_layout.addLayout(actions)
        other_layout.addWidget(audio_card)
        other_layout.addStretch()
        self.workspace_tabs.addTab(other_page, "صوت فقط / HTML")
        video_card, video_layout = card()
        self.video_picker = VideoPicker()
        self.video_picker.requested.connect(self._convert_video)
        video_layout.addWidget(self.video_picker)
        self.workspace_tabs.addTab(video_card, "MP4 متوافق")
        self.inference_picker = InferencePicker(lambda: self.scene_picker.policy.currentData())
        self.scene_picker.policy.currentIndexChanged.connect(self.inference_picker.refresh_policy)
        self.workspace_tabs.addTab(self.inference_picker, "استدلال")
        library_card, library_layout = card()
        library_layout.addWidget(label("مكتبة المنهج · كل ما تولّده محفوظ محليًا", "section"))
        library_layout.addWidget(
            label(
                "كل توليد مكتمل (سبورة، سبورة بالصوت، صوت فقط، صفحة HTML، فيديو بعد التحويل) "
                "يُقترح حفظه هنا تلقائيًا، ويمكنك إضافة أي ملف يدويًا مثل PDF للطباعة أو فيديو "
                "السبورة المحمّل من المتصفح. كل الحقول اختيارية باسمين حرين: الدولة، المرحلة، "
                "الصف، السنة الدراسية، المادة، الترم. لا يغادر شيء جهازك.",
                "muted",
                True,
            )
        )
        self.library_panel = LibraryPanel(self.lesson_library)
        self.library_panel.editRequested.connect(self._edit_library_entry)
        self.library_panel.entryDeleted.connect(self._library_entry_deleted)
        self.library_panel.videoExportRequested.connect(self._library_entry_export_video)
        self.library_panel.editCancelled.connect(self._cancel_library_edit)
        library_layout.addWidget(self.library_panel)
        self.workspace_tabs.addTab(library_card, "مكتبة المنهج")
        export_actions.addWidget(self.cancel_button)
        export_layout.addLayout(export_actions)
        self.progress = QProgressBar()
        self.progress.hide()
        export_layout.addWidget(self.progress)
        self.status = label(
            ("اكتب سكريبتًا لإنشاء سبورة، أو أضف نموذجًا لتوليد الصوت."), "muted", True
        )
        self.status.setAccessibleName("حالة العملية")
        export_layout.addWidget(self.status)

        self.result_section = Disclosure("النتيجة والاستماع · افتح لعرض الملف وأدواته")
        player_layout = self.result_section.content_layout
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
        self.result_path.setMaximumHeight(44)
        player_layout.addWidget(self.result_path)
        export_layout.addWidget(self.result_section)
        outer.addWidget(export_card)

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
        self.azure_picker.set_dialogue(dialogue)
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

    def _using_azure(self) -> bool:
        return self.provider_combo.currentData() == "azure"

    def _provider_changed(self, *_args) -> None:
        azure = self._using_azure()
        self.voice_tabs.setVisible(not azure)
        self.azure_picker.setVisible(azure)
        for widget in (self.add_voice_button, self.refresh_button):
            widget.setVisible(not azure)
        self.setup_hint.setVisible(not azure and not self.voices)
        self.privacy_badge.setText(
            "Azure سحابي · لا إرسال دون مراجعة وإذن" if azure else "محلي · الاقتراح الشبكي اختياري"
        )
        if not azure:
            self.azure_picker.forget()
        self._update_buttons()

    def _azure_forgotten(self) -> None:
        if self._active_azure_job is not None:
            self._active_azure_job.close()
            if self.worker:
                self.worker.cancel_event.set()

    @staticmethod
    def _cloud_source_hash(source: Path) -> str:
        # Recheck a bounded original, not an arbitrarily grown file from another process.
        digest = sha256()
        total = 0
        with source.open("rb") as handle:
            while data := handle.read(65536):
                total += len(data)
                if total > MAX_HTML_BYTES:
                    raise AzureError("كبر ملف المصدر أثناء المراجعة؛ اختره وراجعه مجددًا.")
                digest.update(data)
        return digest.hexdigest()

    def _cloud_snapshot(self, source: Path | None, for_editor: bool) -> tuple:
        return (
            self.editor.document().revision() if for_editor else None,
            self.provider_combo.currentData(),
            self.azure_picker.revision,
            self.scene_picker.policy.currentData(),
            self.scene_picker.audio_allowed(),
            self.scene_picker.revision if for_editor else None,
            self.lesson_picker.revision if for_editor else None,
            self.mode_combo.currentData(),
            self.speed_slider.value(),
            self.pause_spin.value(),
            self.turn_pause_spin.value(),
            self.format_combo.currentData(),
            self._cloud_source_hash(source) if source is not None else None,
        )

    def _cloud_engine(
        self,
        requests: tuple[CloudRequest, ...],
        *,
        source: Path | None = None,
        for_editor: bool = True,
    ) -> SpeechEngine | None:
        if not requests:
            raise AzureError("لا توجد مقاطع Azure صالحة في هذه العملية.")
        self._options(for_editor=for_editor)
        credentials = self.azure_picker.credentials()
        before = self._cloud_snapshot(source, for_editor)
        plan = AzurePlan(requests)
        dialog = AzureConsentDialog(plan, credentials.region, self)
        if dialog.exec() != QDialog.DialogCode.Accepted or not dialog.review_check.isChecked():
            return None
        if before != self._cloud_snapshot(source, for_editor) or self.worker:
            raise AzureError("تغير المصدر أو سياق الإرسال أثناء المراجعة؛ وافق مجددًا.")
        self._options(for_editor=for_editor)
        self._active_azure_job = AzureJob(
            plan, credentials, consent=True, policy=self.scene_picker.policy.currentData()
        )
        return SpeechEngine(azure_job=self._active_azure_job)

    def _engine_for_script(
        self,
        text: str,
        cast: dict[int, DialogueVoice],
        options: RenderOptions,
        *,
        source: Path | None = None,
    ) -> SpeechEngine | None:
        if not self._using_azure():
            return self.engine
        try:
            requests = self.engine.script_cloud_requests(
                text,
                cast,
                options,
                dialogue=self.dialogue_mode(),
                turn_pause_ms=self.turn_pause_spin.value(),
            )
            return self._cloud_engine(requests, source=source)
        except (OSError, ScriptError, VoiceError, AudioError) as error:
            QMessageBox.warning(self, "راجع إرسال Azure", str(error))
            return None

    def _engine_for_lesson(
        self,
        lesson: Lesson,
        cast: dict[int, DialogueVoice],
        options: RenderOptions,
        *,
        source: Path | None = None,
    ) -> SpeechEngine | None:
        if not self._using_azure():
            return self.engine
        try:
            requests = whiteboard_cloud_requests(
                self.engine, lesson, cast, options, turn_pause_ms=self.turn_pause_spin.value()
            )
            return self._cloud_engine(requests, source=source, for_editor=source is None)
        except (OSError, ScriptError, VoiceError, AudioError) as error:
            QMessageBox.warning(self, "راجع إرسال Azure", str(error))
            return None

    def selected_voice(self) -> VoiceSpec | None:
        return self.primary_voice.selected_voice()

    def _cast(self) -> dict[int, DialogueVoice]:
        if self._using_azure():
            if not self.azure_picker.ready():
                return {}
            return {
                1: DialogueVoice(self.azure_picker.first_voice.currentData()),
                2: DialogueVoice(self.azure_picker.second_voice.currentData()),
            }
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
        self.setup_hint.setVisible(not self.voices and not self._using_azure())
        if warnings:
            self.status.setText(f"تم تجاهل {len(warnings)} نموذج غير مكتمل أو غير متوافق.")
            self.status.setToolTip("\n".join(warnings[:10]))
        else:
            self.status.setToolTip("")
        self._update_buttons()

    def _update_text_stats(self) -> None:
        text = self.editor.toPlainText()
        self.appearance_picker.invalidate_rows()
        self.scene_picker.invalidate_source()
        self.text_stats.setText(
            f"{len(text):,} / {MAX_CHARACTERS:,} حرف   ·   {len(text.split()):,} كلمة"
        )
        self._update_buttons()

    def _update_buttons(self) -> None:
        busy = self.worker is not None
        self.workspace_tabs.setEnabled(not busy)
        self.video_picker.set_allowed(self.scene_picker.policy.currentData() == "general")
        text = self.editor.toPlainText()
        required = {1}
        if self.dialogue_mode():
            try:
                required = {turn.speaker for turn in parse_dialogue(text)}
            except ScriptError:
                required = {1, 2}
        ready = required.issubset(self._cast()) and 0 < len(text.strip()) <= MAX_CHARACTERS
        story_ready = self._story_ready()
        speech_allowed = self.scene_picker.audio_allowed() and story_ready
        self.generate_button.setEnabled(not busy and ready and speech_allowed)
        self.preview_button.setEnabled(not busy and ready and speech_allowed)
        self.html_export_button.setEnabled(
            not busy and ready and speech_allowed and self._html_source is not None
        )
        self.clear_html_button.setEnabled(not busy and self._html_source is not None)
        scene_ready = self.scene_picker.export_ready() and story_ready
        self.create_board_button.setEnabled(
            not busy and scene_ready and 0 < len(text.strip()) <= MAX_CHARACTERS
        )
        combined_ready = False
        if not busy and 0 < len(text.strip()) <= MAX_CHARACTERS and (cast := self._cast()):
            try:
                # Lesson headings are structural, not untagged dialogue turns.
                combined_ready = parse_lesson(
                    text, dialogue=self.dialogue_mode()
                ).speakers.issubset(cast)
            except ScriptError:
                pass
        self.combined_board_button.setEnabled(
            combined_ready and scene_ready and self.scene_picker.audio_allowed()
        )
        self.open_board_button.setEnabled(not busy and self._board_open_file is not None)
        board_ready = self._board_lesson is not None and self._board_lesson.speakers.issubset(
            self._cast()
        )
        sacred_board = bool(
            self._board_lesson
            and self._board_lesson.visuals
            and self._board_lesson.visuals.to_data()["policy"] == "sacred"
        )
        self.board_audio_button.setEnabled(
            not busy and board_ready and not sacred_board and self.scene_picker.audio_allowed()
        )
        if self._board_source and self._board_lesson:
            changed = bool(text.strip()) and text.strip() != self._board_lesson.script
            note = (
                " · السكريبت الحالي مختلف؛ الخطوة 2 تستخدم النص المحفوظ في هذه السبورة. "
                "أعد الخطوة 1 لتطبيق تعديلات النص."
                if changed
                else " · الصوت من النص والخطة المحفوظين في HTML، لا تعديلات المحرر الحالية."
            )
            if sacred_board:
                note = " · نصوص مقدسة: عرض النص المراجع فقط؛ لا توليد تلاوة آلي في هذه النسخة."
            self.board_source_label.setText(
                f"{self._board_source.name} · {len(self._board_lesson.steps)} خطوات" + note
            )
            self.board_source_label.setToolTip(str(self._board_source))
        elif self._board_open_file:
            self.board_source_label.setText(
                f"{self._board_open_file.name} · سبورة بالنص والصوت في ملف واحد. "
                "لإعادة التوليد استخدم السكريبت والزر الموحّد، أو أنشئ نسخة صامتة بالخطوة 1."
            )
            self.board_source_label.setToolTip(str(self._board_open_file))
        for widget in (
            self.primary_voice,
            self.provider_combo,
            self.azure_picker,
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

    def _options(self, *, for_editor: bool = True) -> RenderOptions:
        if for_editor and not self._story_ready():
            raise VoiceError(
                "الوصف أو المسودة أو النص تغيّر، أو المشاهد لم تُعتمد؛ "
                "راجعها مجددًا أو افصل الارتباط صراحة."
            )
        if not self.scene_picker.audio_allowed():
            raise VoiceError(
                "حماية النصوص المقدسة مفعّلة؛ لا نطق آلي أو إرسال صوتي إلى Azure في هذا الوضع."
            )
        return RenderOptions(
            speed=self.speed_slider.value() / 100,
            pause_ms=self.pause_spin.value(),
            speaker_id=0 if self._using_azure() else self.primary_voice.speaker_id(),
        )

    def _input(self) -> tuple[str, dict[int, DialogueVoice]] | None:
        if self.worker:
            return None
        try:
            self._options()  # Also guard keyboard/shortcut paths before any save dialog.
            text = validate_text(self.editor.toPlainText())
            if self._adopted_draft is not None:
                text = self._lesson_for_export().spoken_script  # Brief/headings are never spoken.
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
        engine = self._engine_for_script(text, cast, options)
        if engine is None:
            return

        def task(cancel, progress):
            if dialogue:
                return engine.render_dialogue(
                    text, cast, path, options, cancel, progress, turn_pause_ms=pause
                )
            return engine.render(text, cast[1].voice, path, options, cancel, progress)

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

    def _source_lesson(self) -> Lesson:
        return parse_lesson(self.editor.toPlainText(), dialogue=self.dialogue_mode())

    def _bind_story_plan(self, plan: VisualPlan, source: Lesson) -> VisualPlan:
        if self._adopted_draft is None:
            return plan
        brief = self._adopted_draft.brief.to_data()
        if (
            self.lesson_picker.revision != self._adopted_revision
            or self.scene_picker.policy.currentData() != "general"
            or self.scene_picker.subject.text() != brief["subject"]
            or self.scene_picker.grade.text() != brief["grade"]
        ):
            raise SceneError(
                "الوصف أو المسودة أو سياسة المحتوى أو المادة/الصف تغيّرت؛ راجع الدرس أولًا."
            )
        return self._adopted_draft.bind_plan(plan, source)

    def _story_plan(self):
        if self._adopted_draft is None:
            return None
        if not self.scene_picker.use_plan.isChecked():
            raise SceneError("الدرس الكامل يحتاج رسومه؛ أعد تضمينها أو افصل الارتباط صراحة.")
        source = self._source_lesson()
        plan = self.scene_picker.approved_for(source)
        if plan is None:
            raise SceneError("الدرس الموسع يحتاج خطة رسوم معتمدة.")
        return self._bind_story_plan(plan, source)

    def _story_ready(self) -> bool:
        try:
            self._story_plan()
            return True
        except ScriptError:
            return False

    def _lesson_for_export(self) -> Lesson:
        lesson = self._source_lesson()
        if self._adopted_draft is not None:
            return replace(lesson, visuals=self._story_plan())
        return replace(lesson, visuals=self.scene_picker.approved_for(lesson))

    def _request_lesson(self, request: LessonRequest) -> None:
        if self.worker:
            return
        self._start_task(
            lambda cancel, progress: request_lesson(
                request.brief,
                request.key,
                cancel,
                progress,
                consent=request.consent,
                adult=request.adult,
                secondary_assets=request.secondary_assets,
            ),
            "lesson-draft",
        )

    def _adopt_lesson(self, draft: LessonDraft) -> None:
        if self.worker:
            return
        if (
            QMessageBox.question(
                self,
                "نقل درس بعد مراجعتك",
                "هل راجعت الوصف الأصلي والنص الموسع والحقائق والإجابات والرسوم؟ "
                "سيُستبدل نص المحرر بالدرس لراوٍ واحد، دون تغيير أصواتك أو نطق تلقائي. "
                "بعدها اعتمد خطة المشاهد من القسم التالي قبل التصدير.",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        try:
            if draft != self.lesson_picker.current():
                raise SceneError("تغيّرت المسودة؛ راجع النسخة الحالية.")
            lesson = draft.compile()
            self.mode_combo.setCurrentIndex(0)
            self.editor.setPlainText(lesson.script)
            self.scene_picker.policy.setCurrentIndex(0)
            hints = draft.brief.to_data()
            self.scene_picker.subject.setText(hints["subject"])
            self.scene_picker.grade.setText(hints["grade"])
            self._adopted_draft = draft
            self._adopted_revision = self.lesson_picker.revision
            self.scene_picker.set_draft(lesson.visuals)
            self.scene_section.set_expanded(True)
            self.status.setText(
                "نُقل الدرس الموسع مع حفظ الوصف. راجع خطة المشاهد واعتمدها؛ لم يبدأ صوت أو تصدير."
            )
            self._update_buttons()
        except ScriptError as error:
            QMessageBox.warning(self, "راجع المسودة", str(error))

    def _detach_lesson(self) -> None:
        if self.worker or self._adopted_draft is None:
            return
        if (
            QMessageBox.question(
                self,
                "فصل الارتباط بالوصف",
                "سيبقى النص الحالي والوصف في مسودة JSON، "
                "لكن التصدير التقليدي لن يضمن حفظ ارتباطهما. "
                "هل تريد فصل الارتباط والعودة للتحرير العادي؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        self._adopted_draft = None
        self._adopted_revision = -1
        self.scene_picker.invalidate_source()
        self._update_buttons()

    def _request_scenes(self, request: PlannerRequest) -> None:
        if self.worker:
            return
        if self._adopted_draft is not None:
            try:
                self._bind_story_plan(self._adopted_draft.compile().visuals, self._source_lesson())
            except ScriptError as error:
                QMessageBox.warning(self, "راجع ارتباط الدرس قبل إعادة الرسم", str(error))
                return
        self._start_task(
            lambda cancel, progress: request_plan(
                request.source,
                request.key,
                cancel,
                progress,
                consent=request.consent,
                adult=request.adult,
                subject=request.subject,
                grade=request.grade,
                policy=request.policy,
                secondary_assets=request.secondary_assets,
            ),
            "scene-plan",
        )

    def _request_assets(self, request: AssetRequest) -> None:
        if self.worker:
            return
        self._asset_request = request
        self._start_task(
            lambda cancel, progress: prepare_plan(
                request.plan,
                request.source,
                cancel,
                progress,
                allow_download=request.allow_download,
                directory=self.data_dir / "secondary-assets-v1",
            ),
            "scene-assets",
        )

    def _request_revision(self, request: RevisionRequest) -> None:
        if self.worker:
            return
        try:
            if self._adopted_draft is not None:
                self._bind_story_plan(request.previous, self._source_lesson())
            if (
                request.revision != self.scene_picker.revision
                or request.target_step != self.scene_picker.revision_scope.currentData()
                or self.scene_picker._current()[1] != request.previous
                or self._source_lesson().manifest() != request.source
            ):
                raise SceneError("تغيّر النص أو الرسم قبل بدء المحاولة؛ راجع الاختيار من جديد.")
        except ScriptError as error:
            QMessageBox.warning(self, "راجع اختيار المعاينة", str(error))
            return
        self._revision_request = request
        self._start_task(
            lambda cancel, progress: revise_plan(
                request,
                cancel,
                progress,
                directory=self.data_dir / "secondary-assets-v1",
            ),
            "scene-revision",
        )

    def _scene_example(self) -> None:
        if self.worker:
            return
        if (
            self.editor.toPlainText().strip()
            and QMessageBox.question(
                self,
                "مثال مشاهد محلي",
                "سيُستبدل السكريبت بمثال محلي بلا اتصال. هل تتابع؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        self.mode_combo.setCurrentIndex(0)
        self.editor.setPlainText(VISUAL_EXAMPLE)
        self.scene_picker.policy.setCurrentIndex(0)
        self.scene_section.set_expanded(True)
        self.scene_picker.set_draft(example_plan(self._source_lesson().manifest()))

    def _refresh_appearance_sentences(self) -> None:
        if self.worker:
            return
        try:
            lesson = self._lesson_for_export()
        except ScriptError as error:
            QMessageBox.warning(self, "راجع السكريبت قبل اختيار ألوان الجمل", str(error))
            return
        self.appearance_picker.set_rows(lesson)

    def generate_whiteboard(self) -> None:
        if self.worker:
            return
        try:
            lesson = self._lesson_for_export()
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

    def generate_whiteboard_with_audio(self) -> None:
        if self.worker:
            return
        try:
            lesson = self._lesson_for_export()
            cast, options = self._cast(), self._options()
            validate_lesson_cast(lesson, cast, options)
            appearance = self.appearance_picker.snapshot(lesson)
        except (ScriptError, VoiceError, AudioError, AppearanceError) as error:
            QMessageBox.warning(self, "راجع السكريبت والأصوات والتخصيصات", str(error))
            return
        directory = (
            Path(self.preferences.output_dir) if self.preferences.output_dir else Path.home()
        )
        path = self._board_save_path(
            "حفظ السبورة بالنص والصوت في ملف HTML واحد",
            directory / f"NovaLesson-{datetime.now():%Y%m%d-%H%M%S}-with-voice.html",
        )
        if path is None:
            return
        try:
            # A one-click editor export must not overwrite either selected
            # original page, including aliases/hard links checked by this helper.
            for source in (self._board_source, self._html_source):
                if source is not None and source.exists():
                    validate_destination(source, path)
        except (OSError, HtmlExportError) as error:
            QMessageBox.warning(self, "اختر اسمًا آخر", str(error))
            return
        self.preferences.output_dir = str(path.parent)
        pause, audio_format = self.turn_pause_spin.value(), self.format_combo.currentData()
        engine = self._engine_for_lesson(lesson, cast, options)
        if engine is None:
            return
        self._release_player()
        self.open_html_button.setEnabled(False)
        self._start_task(
            lambda cancel, progress: render_whiteboard_with_audio(
                engine,
                lesson,
                cast,
                path,
                options,
                cancel,
                progress,
                turn_pause_ms=pause,
                audio_format=audio_format,
                appearance=appearance,
            ),
            "whiteboard-combined",
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
            options = self._options(for_editor=False)
            validate_lesson_cast(board.lesson, cast, options)
        except (OSError, HtmlExportError, ScriptError, VoiceError, AudioError) as error:
            QMessageBox.warning(self, "راجع السبورة والأصوات", str(error))
            return
        current_text = self.editor.toPlainText().strip()
        if board.lesson.visuals and board.lesson.visuals.to_data()["schema"] == 2:
            # A saved full-lesson page can come from a silent draft preview.
            # Approval is never serialized: review this independent saved source,
            # without letting an unrelated stale editor draft block its workflow.
            if (
                QMessageBox.question(
                    self,
                    "مراجعة درس موسع محفوظ قبل توليد صوته",
                    "قد يكون هذا الملف معاينة مسودة؛ الحزمة لا تحفظ اعتمادًا بشريًا. "
                    "هل فتحت السبورة وراجعت الوصف الأصلي والنص والحقائق والإجابات "
                    "والرسوم وكل فرق بين العرض والنطق، وتوافق على توليد صوتها الآن؟ "
                    "الصوت من بيانات هذا الملف المحفوظ، لا من المحرر أو مسودة أخرى.",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                    QMessageBox.StandardButton.No,
                )
                != QMessageBox.StandardButton.Yes
            ):
                return
        elif (
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
        engine = self._engine_for_lesson(board.lesson, cast, options, source=source)
        if engine is None:
            return
        self._release_player()
        self.open_html_button.setEnabled(False)
        self._start_task(
            lambda cancel, progress: render_whiteboard_audio(
                engine,
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
        engine = self._engine_for_script(text, cast, options, source=source)
        if engine is None:
            return

        def task(cancel, progress):
            return render_html(
                engine,
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

    # -------------------------------------------------------- lesson library
    def _offer_library_save(
        self, path, kind: str, suggested_title: str = "", *, script=None
    ) -> None:
        """Offer to archive a completed output in «مكتبة المنهج» (skippable)."""
        if self._closing:
            return
        source = Path(path)
        if not source.is_file():
            return
        preselect_id = None
        if self._editing_entry_id is not None:
            current = self.lesson_library.get(self._editing_entry_id)
            preselect_id = current.id if current is not None else None
        if preselect_id is not None:
            title, metadata, notes = (
                current.title,
                current.metadata,
                current.notes,
            )
        else:
            title = suggested_title.strip() if suggested_title else source.stem
            title = title[:200] or source.stem
            metadata = LibraryMetadata(
                country=self._library_last_meta.country,
                stage=self._library_last_meta.stage,
                grade=self.scene_picker.grade.text().strip()
                or self._library_last_meta.grade,
                academic_year=self._library_last_meta.academic_year,
                subject=self.scene_picker.subject.text().strip()
                or self._library_last_meta.subject,
                term=self._library_last_meta.term,
            )
            notes = ""
        script_text = (
            self.editor.toPlainText() if script is None and kind != "video" else script or ""
        )
        dialog = LibrarySaveDialog(
            self,
            title=title,
            metadata=metadata,
            notes=notes,
            library=self.lesson_library,
            preselect_id=preselect_id,
        )
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        values = dialog.result_values()
        if not values.title:
            QMessageBox.warning(self, "العنوان مطلوب", "اكتب عنوانًا للإدخال في المكتبة.")
            return
        self._library_last_meta = values.metadata
        try:
            if values.update_id is not None:
                self.lesson_library.update(
                    values.update_id,
                    title=values.title,
                    files={"main": source},
                    metadata=values.metadata,
                    script=script_text,
                    notes=values.notes,
                )
                message = f"حُدّث الإدخال #{values.update_id} «{values.title}» في مكتبة المنهج."
            else:
                self.lesson_library.add(
                    title=values.title,
                    kind=kind,
                    files={"main": source},
                    metadata=values.metadata,
                    script=script_text,
                    notes=values.notes,
                )
                message = f"أُضيف «{values.title}» إلى مكتبة المنهج."
        except LibraryError as error:
            QMessageBox.warning(self, "تعذر الحفظ في المكتبة", str(error))
            return
        self.library_panel.refresh()
        self.status.setText(message)

    def _edit_library_entry(self, entry_id: int) -> None:
        if self.worker:
            QMessageBox.information(
                self, "انتظر اكتمال العملية", "أنهِ أو ألغِ العملية الجارية قبل فتح إدخال للتعديل."
            )
            return
        entry = self.lesson_library.get(entry_id)
        if entry is None:
            QMessageBox.warning(
                self, "الإدخال غير موجود", "لم يُعثر على الإدخال؛ جرى تحديث القائمة."
            )
            self.library_panel.refresh()
            return
        if not entry.script.strip():
            QMessageBox.information(
                self,
                "إدخال بلا سكريبت",
                "هذا الإدخال أُضيف كملف (مثل فيديو أو PDF) دون سكريبت، فلا يمكن تحميله في المحرر. "
                "افتح الملف أو مجلده من أزرار المكتبة بدلًا من ذلك.",
            )
            return
        if self.editor.toPlainText().strip() and (
            QMessageBox.question(
                self,
                "فتح للتعديل؟",
                f"سيُستبدل النص الحالي في المحرر بالنص المحفوظ في إدخال «{entry.title}». "
                "هل تريد المتابعة؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        self.editor.setPlainText(entry.script)
        self.scene_picker.subject.setText(entry.metadata.subject)
        self.scene_picker.grade.setText(entry.metadata.grade)
        self._editing_entry_id = entry.id
        self.workspace_tabs.setCurrentIndex(0)
        self._update_buttons()
        self.status.setText(
            f"وضع التحرير لإدخال مكتبة المنهج «{entry.title}». بعد أي تصدير ستُسأل: "
            "تحديث نفس الإدخال (استبدال) أو إنشاء إدخال جديد."
        )

    def _library_entry_deleted(self, entry_id: int) -> None:
        if self._editing_entry_id == entry_id:
            self._editing_entry_id = None
            self.status.setText(
                "حُذف الإدخال الذي كنت تحرره؛ التصديرات القادمة تُحفظ كإدخالات جديدة."
            )

    def _cancel_library_edit(self) -> None:
        self._editing_entry_id = None
        self.status.setText("أُنهي وضع تحرير إدخال المكتبة؛ التصديرات القادمة تُحفظ كإدخالات جديدة.")

    def _library_entry_export_video(self, entry_id: int) -> None:
        """«تحويل إلى فيديو»: capture the archived whiteboard inside the app."""
        if self.worker:
            QMessageBox.information(
                self, "انتظر اكتمال العملية", "أنهِ أو ألغِ العملية الجارية قبل تصدير الفيديو."
            )
            return
        entry = self.lesson_library.get(entry_id)
        if entry is None:
            QMessageBox.warning(
                self, "الإدخال غير موجود", "لم يُعثر على الإدخال؛ جرى تحديث القائمة."
            )
            self.library_panel.refresh()
            return
        record = self.lesson_library.main_file(entry)
        if record is None or not is_exportable_main(record.filename):
            QMessageBox.information(
                self,
                "التحويل متاح للسبورة HTML فقط",
                "يحتاج زر «تحويل إلى فيديو» إدخالًا ملفه الرئيسي صفحة HTML سبورة Nova "
                "(تحمل الرسوم والتوقيت). أضف فيديو جاهزًا بزر «إضافة ملف موجود…».",
            )
            return
        html_copy = self.lesson_library.entry_file(entry_id, record.filename)
        if not html_copy.is_file():
            QMessageBox.warning(
                self,
                "الملف غير موجود",
                "ملف السبورة غير موجود داخل المكتبة. قد تكون حذفته يدويًا؛ "
                "احذف الإدخال أو أعد إضافته.",
            )
            return
        answer = QMessageBox.question(
            self,
            "تحويل إلى فيديو؟",
            f"سيُسجّل البرنامج نسخة «{entry.title}» المحفوظة كفيديو: الحركة "
            "والصوت المضمّن بالتوقيت نفسه، داخل النظام دون فتح متصفح خارجي. "
            "المدة = مدة الدرس. اترك نافذة التسجيل ظاهرة حتى تكتمل.\n\n"
            "سيُحفظ الفيديو داخل نفس الإدخال بدور «فيديو» ويستبدل النسخة "
            "السابقة إن وُجدت. هل تريد المتابعة؟",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.Yes,
        )
        if answer != QMessageBox.StandardButton.Yes:
            return
        staging = Path(tempfile.mkdtemp(prefix=f"nova-voice-video-{entry_id}-"))
        state = {"cancelled": False, "staging": staging}
        progress = QProgressDialog("جارٍ تجهيز السبورة للتسجيل…", "إلغاء", 0, 1000, self)
        progress.setWindowTitle("تحويل إلى فيديو — داخل النظام")
        progress.setWindowModality(Qt.WindowModal)
        progress.setMinimumDuration(0)
        progress.setAutoClose(False)
        progress.setAutoReset(False)
        progress.resize(460, 150)
        self.status.setText("جارٍ تسجيل الفيديو داخل النظام…")

        def on_progress(fraction, text):
            progress.setValue(int(fraction * 1000))
            text = str(text or "").strip()
            if text:
                progress.setLabelText(text[:140])

        def finish_cleanup():
            try:
                import shutil

                shutil.rmtree(state["staging"], ignore_errors=True)
            except Exception:  # noqa: BLE001 — leftover temp dir is harmless
                pass

        def on_finished(path):
            progress.reset()
            progress.close()
            self._video_exporter = None
            saved = None
            try:
                self.lesson_library.update(
                    entry_id, files={"video": path}
                )
                saved = "library"
            except LibraryError as error:
                if QMessageBox.question(
                    self,
                    "تعذر الحفظ في المكتبة",
                    f"{error}\n\nهل تريد حفظ الفيديو على جهازك بدلًا من ذلك؟",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                    QMessageBox.StandardButton.Yes,
                ) == QMessageBox.StandardButton.Yes:
                    destination, _ = QFileDialog.getSaveFileName(
                        self,
                        "حفظ الفيديو",
                        str(Path(path).name),
                        "فيديو (*.webm *.mp4);;كل الملفات (*)",
                    )
                    if destination:
                        import shutil

                        shutil.copy2(path, destination)
                        saved = "file"
            finish_cleanup()
            if saved:
                self.library_panel.refresh()
                if saved == "library":
                    message = f"أُضيف فيديو «{entry.title}» إلى نفس الإدخال في مكتبة المنهج."
                else:
                    message = f"حُفظ فيديو «{entry.title}» على جهازك (تعذر الحفظ في المكتبة)."
                self.status.setText(message)
                QMessageBox.information(
                    self,
                    "اكتمل التحويل",
                    message
                    + "\nافتح مجلد الإدخال من أزرار المكتبة لمشاهدته والتحقق من الصورة والصوت.",
                )
            else:
                self.status.setText("اكتمل التسجيل لكن الفيديو لم يُحفظ بعد؛ راجع الرسالة.")

        def on_failed(message):
            progress.reset()
            progress.close()
            self._video_exporter = None
            finish_cleanup()
            if state["cancelled"]:
                self.status.setText("أُلغي التصدير؛ لم يُحفظ فيديو جزئي.")
                return
            self.status.setText("تعذر التصدير؛ لم يُحفظ فيديو جزئي.")
            QMessageBox.warning(
                self,
                "تعذر التحويل إلى فيديو",
                f"{message}\n\nتأكد أن الإدخال صفحة سبورة Nova سليمة (وليست نسخة «نصوص مقدسة»)، "
                "وأن الصوت المضمّن سليم، وأن الجهاز قادر على التعامل مع الدرس. "
                "لا يُحفظ ملف جزئي عند الفشل.",
            )

        def on_cancel():
            state["cancelled"] = True

        exporter = LessonVideoExporter(
            html_copy,
            staging,
            on_progress=on_progress,
            on_finished=on_finished,
            on_failed=on_failed,
            parent=self,
        )
        self._video_exporter = exporter  # keep a reference until completion
        progress.canceled.connect(on_cancel)
        progress.canceled.connect(exporter.cancel)
        try:
            started = exporter.start()
        except Exception as error:  # noqa: BLE001 — engine missing/broken must not crash the app
            logging.getLogger(__name__).exception("QtWebEngine capture failed to start")
            started = False
            QMessageBox.warning(
                self,
                "تعذر تجهيز المحرك المضمّن",
                f"تعذر بدء المحرك المضمّن للتسجيل: {error}\n\n"
                "الحل: ثبّت متطلبات البناء كاملة (Setup-Windows.bat) وتحقق من توفر "
                "مكتبات QtWebEngine في %LOCALAPPDATA%، أو سجّل الفيديو من داخل صفحة "
                "«السبورة الناتجة» كما كنت تفعل.",
            )
        if not started and self._video_exporter is not None:
            progress.reset()
            progress.close()
            self._video_exporter = None
            import shutil

            shutil.rmtree(staging, ignore_errors=True)
            self.status.setText("تعذر بدء التسجيل؛ لم يُحفظ فيديو.")

    def _convert_video(self, request: ConversionRequest) -> None:
        if (
            self.worker
            or self.scene_picker.policy.currentData() != "general"
            or self.video_picker.current() != request
        ):
            return
        selected, _ = QFileDialog.getSaveFileName(
            self,
            "حفظ MP4 جديد · تحويل فعلي إلى H.264/AAC",
            str(request.source.with_name(request.source.stem + "-compatible.mp4")),
            "MP4 (*.mp4)",
        )
        if not selected:
            return
        destination = Path(selected)
        if destination.suffix.lower() != ".mp4":
            destination = destination.with_suffix(".mp4")
        # QFileDialog only confirms the name displayed in it, not an appended
        # extension. Ask explicitly if that resulting destination already exists.
        overwrite = destination.exists()
        if (
            overwrite
            and QMessageBox.question(
                self,
                "استبدال MP4 موجود؟",
                "سيُستبدل الملف بعد نجاح التحويل والفحص الكامل فقط. هل تتابع؟",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            != QMessageBox.StandardButton.Yes
        ):
            return
        self._start_task(
            lambda cancel, progress: convert_video(
                request.source,
                destination,
                request.ffmpeg,
                cancel,
                progress,
                reviewed=True,
                overwrite=overwrite,
            ),
            "video-convert",
        )

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
            "video-convert": "جارٍ التحويل المحلي إلى H.264/AAC؛ لا رفع ملفات أو تغيير للأصل…",
            "scene-plan": "جارٍ طلب اقتراح مجاني واحد بإذنك؛ لا رسم أو نطق قبل المراجعة…",
            "scene-assets": "جارٍ تجهيز الموارد المسموح بها وفحصها؛ لا اعتماد أو نطق أو تصدير…",
            "scene-revision": "جارٍ تجهيز اختيارك: اقتراح واحد وموارد مدققة فقط، ثم معاينة صامتة…",
            "lesson-draft": "جارٍ اقتراح درس كامل ورسوم بطلب مجاني واحد؛ لا اعتماد أو نطق تلقائي…",
            "html": "جارٍ تجهيز الصفحة وتوليد الصوت محليًا…",
            "whiteboard": "جارٍ تحويل السكريبت إلى سبورة HTML محليًا…",
            "whiteboard-audio": "جارٍ توليد مقطع صوتي لكل خطوة من السبورة…",
            "whiteboard-combined": "جارٍ إنشاء السبورة وتوليد صوتها في ملف HTML واحد…",
        }
        self.status.setText(
            "جارٍ إرسال المقاطع المراجعة إلى Azure بإذنك ثم حفظ الناتج محليًا؛ لا إعادة مدفوعة…"
            if self._active_azure_job is not None
            else messages.get(kind, "جارٍ تجهيز المحرك المحلي…")
        )
        self.progress.setRange(0, 0)
        self._update_buttons()
        self.worker.start()

    def _task_progress(self, value: int) -> None:
        if self._active_azure_job is not None:
            self.progress.setRange(0, 0 if value < 0 else 100)
            if value >= 0:
                self.progress.setValue(value)
            self.status.setText(
                "جارٍ توليد المقاطع المراجعة عبر Azure وحفظ الصوت محليًا؛ "
                "تُراعى حدود المعدل، ولا إعادة تلقائية عند الفشل…"
            )
            return
        if value < 0:
            self.progress.setRange(0, 0)
            if (
                self._progress_kind == "whiteboard-combined"
                and self.worker
                and not self.worker.cancel_event.is_set()
            ):
                self.status.setText("جارٍ تجهيز نماذج الصوت المحلية للسبورة…")
        else:
            self.progress.setRange(0, 100)
            self.progress.setValue(value)
            if self.worker and not self.worker.cancel_event.is_set():
                if self._progress_kind == "whiteboard-combined":
                    stage = (
                        "إنشاء السبورة المؤقتة"
                        if value <= 5
                        else "توليد صوت السبورة"
                        if value < 86
                        else "حفظ النص والصوت داخل HTML"
                    )
                    self.status.setText(f"جارٍ {stage} محليًا… {value}%")
                elif self._progress_kind in ("html", "whiteboard-audio"):
                    stage = "حفظ الصوت داخل HTML" if value >= 85 else "توليد صوت الصفحة"
                    self.status.setText(f"جارٍ {stage} محليًا… {value}%")
                elif self._progress_kind in ("scene-plan", "lesson-draft"):
                    self.status.setText("وصل رد المزود؛ جارٍ التحقق المحلي من خطة المشاهد…")
                elif self._progress_kind in ("scene-assets", "scene-revision"):
                    self.status.setText(f"جارٍ فحص وتجهيز موارد الخطة الاختيارية… {value}%")
                elif self._progress_kind == "video-convert":
                    self.status.setText("جارٍ فحص حاوية MP4 وفك الفيديو كاملًا قبل نشر الملف…")
                elif self._progress_kind == "whiteboard":
                    self.status.setText(f"جارٍ إنشاء ملف السبورة… {value}%")
                else:
                    self.status.setText(
                        "جارٍ استيراد النموذج…"
                        if self._progress_kind == "import"
                        else f"جارٍ توليد الصوت على جهازك… {value}%"
                    )

    def _task_success(self, result: Any) -> None:
        if self._closing or (self.worker and self.worker.cancel_event.is_set()):
            return
        if self._progress_kind == "import":
            self.status.setText("تمت إضافة النموذج. اكتب السكريبت لتجربة الصوت.")
            return
        if isinstance(result, VideoResult):
            self.video_picker.set_result(result)
            self.status.setText(
                "حُفظ MP4 بترميز H.264 وصوت AAC إن وُجد، وفُك الخرج كاملًا. جرّبه على جهازك."
            )
            self._offer_library_save(result.path, "video", result.path.stem, script="")
            return
        if isinstance(result, RevisionResult):
            try:
                if self._revision_request is None:
                    raise SceneError("لا يوجد اختيار معاينة حالي لهذه النتيجة.")
                self.scene_picker.apply_revision(result, self._revision_request)
                self.scene_section.set_expanded(True)
                self.status.setText(
                    "انتهت محاولة واحدة. راجع النتيجة والموارد والبدائل، ثم اختر هل هذا المطلوب. "
                    "لم يبدأ صوت أو اعتماد أو تصدير."
                )
            except ScriptError as error:
                QMessageBox.warning(self, "راجع اختيار المعاينة الحالي", str(error))
            return
        if isinstance(result, AssetPreparation):
            try:
                if self._asset_request is None:
                    raise SceneError("لا يوجد طلب موارد حالي لهذه النتيجة.")
                self.scene_picker.apply_assets(result, self._asset_request)
                self.scene_section.set_expanded(True)
                self.status.setText(
                    "جُهّزت الخطة مع بيان الموارد والبدائل. راجع المعاينة الصامتة والنسبة "
                    "واعتمد من جديد؛ لم يبدأ صوت أو تصدير."
                )
            except ScriptError as error:
                QMessageBox.warning(self, "راجع الخطة الحالية", str(error))
            return
        if isinstance(result, LessonDraft):
            try:
                self.lesson_picker.set_draft(result)
                self.lesson_section.set_expanded(True)
                self.status.setText(
                    "وصلت مسودة درس كامل ورسوم وأسئلة؛ راجعها. لم يتغير المحرر أو يبدأ صوت."
                )
            except ScriptError as error:
                QMessageBox.warning(self, "راجع الوصف الحالي", str(error))
            return
        if isinstance(result, VisualPlan):
            if self._adopted_draft is not None:
                try:
                    result = self._bind_story_plan(result, self._source_lesson())
                except ScriptError as error:
                    QMessageBox.warning(self, "النص تغير عن المسودة", str(error))
                    return
            self.scene_section.set_expanded(True)
            self.scene_picker.set_draft(result)
            self.status.setText(
                "وصلت مسودة مشاهد؛ راجع الوصف والعرض والنطق والمعاينة ثم اعتمدها. "
                "لم يبدأ تصدير أو صوت."
            )
            return
        if isinstance(result, (WhiteboardResult, HtmlAudioResult, RenderResult)):
            self.result_section.set_expanded(True)
            self.result_path.setToolTip(str(result.path))
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
            self._offer_library_save(result.path, "whiteboard", result.lesson.title)
            return
        if isinstance(result, HtmlAudioResult):
            if self._progress_kind in ("whiteboard-audio", "whiteboard-combined"):
                # Never store the combined job's deleted staging HTML as a source.
                # Keep any previously selected silent board for the old step 2.
                self._board_open_file = result.path
            self._result_file = result.path
            self._html_result_file = result.path
            self.player_title.setText("صفحة HTML الصوتية جاهزة")
            self.result_path.setText(str(result.path))
            message = (
                "تم توليد السبورة بالنص والصوت معًا في ملف HTML واحد. "
                "افتحه لعرض النص وتشغيل الصوت والتحكم بالسرعة. "
                if self._progress_kind == "whiteboard-combined"
                else "اكتملت الخطوة 2: نسخة السبورة بالصوت لكل خطوة جاهزة. "
                "افتحها للتحكم بالصوت والكتابة. "
                if self._progress_kind == "whiteboard-audio"
                else "تم حفظ نسخة HTML جديدة والصوت داخلها. افتحها للتحكم بالسرعة. "
            )
            self.status.setText(
                message + f"مدة الصوت {clock(round(result.duration_seconds * 1000))}."
            )
            self.open_folder_button.setEnabled(True)
            self.open_html_button.setEnabled(True)
            board_kind = (
                "whiteboard-audio"
                if self._progress_kind in ("whiteboard-audio", "whiteboard-combined")
                else "html-page"
            )
            self._offer_library_save(result.path, board_kind, result.path.stem)
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
        else:
            self._offer_library_save(result.path, "audio", result.path.stem)

    def _task_error(self, message: str) -> None:
        self.status.setText("لم تكتمل العملية. لم تتغير الملفات السابقة أو الصفحة الأصلية.")
        if not self._closing:
            QMessageBox.warning(self, "تعذّر إتمام العملية", message)

    def _task_cancelled(self) -> None:
        self.status.setText(
            "أُلغي تجهيز الموارد دون تغيير الخطة. قد تبقى موارد مكتملة ومدققة في الذاكرة المحلية."
            if self._progress_kind in ("scene-assets", "scene-revision")
            else "تم الإلغاء. لم يتم استبدال أي ملف سابق أو الصفحة الأصلية."
        )

    def _task_finished(self) -> None:
        if self._active_azure_job is not None:
            self._active_azure_job.close()
            self._active_azure_job = None
        self._asset_request = None
        self._revision_request = None
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
            if self._active_azure_job is not None:
                self._active_azure_job.close()
            self.worker.cancel_event.set()
            self.cancel_button.setEnabled(False)
            self.status.setText(
                "جارٍ الإلغاء… قد يلزم انتظار مهلة الشبكة أو اكتمال المقطع المحلي الحالي."
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
                "ثم اضغط «إضافة نموذج». Azureاختياري منفصل بمفتاح وRegionوإقرار F0؛ "
                "راجع AZURE-SPEECH-AR.md ولا ترسل المفتاح في المحادثة.",
            )

    def _about(self) -> None:
        QMessageBox.about(
            self,
            "حول Nova Voice",
            f"Nova Voice {__version__}\nPiperمحلي افتراضي وAzureسحابي اختياري.\n\n"
            "الرسم محلي؛ Azureواقتراح المشاهد عبر الإنترنت اختياريان بإذن مستقل.\n"
            "لا يُحفظ السكريبت أو مفتاح API تلقائيًا؛ لا تُرسل بيانات شخصية.\n"
            "الأصوات المحلية من نماذجك. Azureيحتاج F0تتحقق منه؛ المفتاح لا يثبت المجانية.\n"
            "لا استنساخ أصوات أو ترقية أو تبديل صوت تلقائي.\n\n"
            "هذا التطبيق الفرعي مرخص تحت GPL-3.0-or-later، دون أي ضمان. "
            "يسمح بإعادة توزيعه وتعديله وفق الترخيص. راجع LICENSE وTHIRD_PARTY.md بجانب البرنامج. "
            "لكل نموذج صوتي ترخيص مستقل موضح في MODEL_CARD.",
        )

    def cleanup(self) -> None:
        if self._cleanup_done:
            return
        self._cleanup_done = True
        self.azure_picker.forget()
        self.azure_picker.timer.stop()
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
        for temporary in (self.lesson_picker, self.scene_picker, self._preview_directory):
            try:
                temporary.cleanup()
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
