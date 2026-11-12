"""In-system «تحويل إلى فيديو» for lessons archived in «مكتبة المنهج».

The whiteboard HTML stored in a library entry is a fully self-contained Chromium
page: it can render every frame of the lesson (drawings + embedded audio) on a
canvas and encode it with MediaRecorder. This module drives that page inside an
embedded QtWebEngine view (the Chromium engine already bundled with PySide6 —
no external browser is launched and nothing touches the network) and captures
the resulting download in-process, so the video with حركة + صوت lands next to
the entry as the ``video`` file role.

Design notes / limits:
- Everything is local; the page never leaves the machine (``file://`` only,
  in-memory profile, no cookies, no network).
- The page must be *visible* while recording (it refuses when
  ``document.hidden`` is true), so a small on-top window is shown for the
  whole capture. Do not close it.
- Captures need an audio clip duration, canvas + MediaRecorder support and a
  non-sacred lesson — the same rules as the in-page «تصدير الفيديو» button,
  which this button presses programmatically after confirming the review box.
  Sacred content stays unexportable, by design.
- Nothing is written to the library until the capture finishes; a cancelled or
  failed capture leaves no partial file behind.
- Qt and its GL stack cannot run in headless/CI sandboxes; the pure helpers in
  this module are unit-tested, the widget wiring is covered on the owner's
  Windows machine where Qt runs.
"""

from __future__ import annotations

import json
import time

MAX_CAPTURE_SECONDS = 16 * 60  # page self-limits at 15 minutes; watchdog covers it
POLL_INTERVAL_MS = 500

WINDOW_TITLE = "تسجيل الفيديو — اترك النافذة ظاهرة"

# Boots the page exactly like a teacher pressing the two buttons in order.
BOOTSTRAP_JS = """
(function () {
  var review = document.getElementById("wb-output-review");
  var button = document.getElementById("wb-video");
  var statusOf = function () {
    var s = document.getElementById("wb-output-status");
    return s ? String(s.textContent || "") : "";
  };
  if (!review || !button) {
    return JSON.stringify({ started: false,
      reason: "هذه الصفحة ليست سبورة Nova قابلة للتصدير (لوحة «طباعة وفيديو» غير موجودة)." });
  }
  review.checked = true;
  review.dispatchEvent(new Event("change", { bubbles: true }));
  if (button.disabled) {
    return JSON.stringify({
      started: false,
      reason: statusOf() || "التصدير غير متاح لهذه النسخة؛ راجع لوحة «طباعة وفيديو».",
    });
  }
  button.click();
  return JSON.stringify({ started: true, reason: "" });
})()
"""

POLL_JS = """
(function () {
  var p = document.getElementById("wb-video-progress");
  var s = document.getElementById("wb-output-status");
  return JSON.stringify({
    progress: p ? Number(p.value) || 0 : 0,
    status: s ? String(s.textContent || "") : "",
    busy: !!(document.body
      && document.body.dataset
      && document.body.dataset.novaExporting === "true")
  });
})()
"""

CANCEL_JS = """
(function () {
  var btn = document.getElementById("wb-video-cancel");
  if (btn) { btn.click(); }
  return true;
})()
"""

# Substrings that mean the page stopped with an error instead of downloading.
_FAILURE_MARKERS = (
    "تعذّر",
    "أُلغي",
    "توقف",
    "تجاوز",
    "الجهاز",
    "اترك الصفحة ظاهرة",
    "لم يبدأ",
    "لم يُنهِ",
    "لم ينتج",
    "المتصفح لا يدعم",
    "الفيديو غير متاح",
    "مدة/ذاكرة",
    "لم يُنزّل",
    "تأخر",
    "غير متاح",
    "أُلغي",
)
_SUCCESS_MARKER = "طُلب تنزيل"


def is_exportable_main(filename: object) -> bool:
    """True when the entry's main file is an HTML page (Qt-free helper)."""
    text = str(filename or "").strip().lower()
    return text.endswith(".html") or text.endswith(".htm")


def parse_js_json(payload: object) -> dict:
    """Decode a runJavaScript payload that may arrive as str or dict."""
    if isinstance(payload, dict):
        return dict(payload)
    if not isinstance(payload, str):
        return {}
    try:
        value = json.loads(payload)
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def classify_status(status: object) -> str:
    """Map the page status line onto running / success / failed (Qt-free)."""
    text = str(status or "")
    if _SUCCESS_MARKER in text:
        return "success"
    for marker in _FAILURE_MARKERS:
        if marker in text:
            return "failed"
    return "running"


class LessonVideoExporter:
    """Drives the stored whiteboard in QtWebEngine and captures the blob download.

    Signals are plain callbacks (``on_progress(float, str)`` / ``on_finished(path)`` /
    ``on_failed(message)``) so this class never leaks a Qt dependency into tests;
    Qt is imported lazily on first use.
    """

    def __init__(
        self, html_path, staging_dir, *,
        on_progress=None, on_finished=None, on_failed=None, parent=None,
    ):
        from pathlib import Path  # local import keeps module light

        self.html_path = Path(html_path)
        self.staging_dir = Path(staging_dir)
        self.on_progress = on_progress or (lambda _value, _status: None)
        self.on_finished = on_finished or (lambda _path: None)
        self.on_failed = on_failed or (lambda _message: None)
        self._parent = parent
        self._view = None
        self._window = None
        self._poll_timer = None
        self._started = False
        self._finished_path = None
        self._deadline = time.monotonic() + MAX_CAPTURE_SECONDS
        self._closed = False

    # ------------------------------------------------------------- Qt glass
    def start(self) -> bool:
        from PySide6.QtCore import Qt, QTimer, QUrl
        from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile
        from PySide6.QtWebEngineWidgets import QWebEngineView
        from PySide6.QtWidgets import QVBoxLayout, QWidget

        if not self.html_path.is_file():
            self._fail("ملف السبورة المحفوظ غير موجود داخل المكتبة.")
            return False
        self.staging_dir.mkdir(parents=True, exist_ok=True)

        self._profile = QWebEngineProfile(self._parent)
        self._profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.MemoryHttpCache)
        self._profile.setPersistentCookiesPolicy(
            QWebEngineProfile.PersistentCookiesPolicy.NoPersistentCookies
        )
        self._view = QWebEngineView()
        page = QWebEnginePage(self._profile, self._view)
        self._view.setPage(page)
        self._profile.downloadRequested.connect(self._on_download_requested)

        window = QWidget(self._parent)
        window.setWindowTitle(WINDOW_TITLE)
        window.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint, True)
        window.resize(1120, 720)
        layout = QVBoxLayout(window)
        layout.setContentsMargins(8, 8, 8, 8)
        self._view.setParent(window)
        layout.addWidget(self._view)
        self._window = window
        window.show()

        self._view.loadFinished.connect(self._on_load_finished)
        self._view.load(QUrl.fromLocalFile(str(self.html_path)))

        self._poll_timer = QTimer(self._window)
        self._poll_timer.setInterval(POLL_INTERVAL_MS)
        self._poll_timer.timeout.connect(self._poll)
        self._poll_timer.start()
        return True

    def cancel(self) -> None:
        """Ask the page to abort; the capture is then reported as failed."""
        if self._closed:
            return
        try:
            self._view.page().runJavaScript(CANCEL_JS)
        except Exception:  # noqa: BLE001 — page may already be gone
            pass
        self._fail("أُلغي التصدير؛ لم يُحفظ فيديو جزئي.")

    def cleanup(self) -> None:
        """Close the window and release the embedded engine (idempotent)."""
        if self._closed:
            return
        self._closed = True
        if self._poll_timer is not None:
            try:
                self._poll_timer.stop()
            except Exception:  # noqa: BLE001
                pass
        if self._window is not None:
            try:
                self._view.setPage(None)
            except Exception:  # noqa: BLE001
                pass
            try:
                self._window.close()
                self._window.deleteLater()
            except Exception:  # noqa: BLE001
                pass
        for attribute in ("_view", "_window", "_poll_timer", "_profile"):
            setattr(self, attribute, None)

    # ------------------------------------------------------------- helpers
    def _fail(self, message) -> None:
        if self._closed:
            return
        message = str(message or "تعذّر التصدير؛ لم يُحفظ فيديو جزئي.")
        self.cleanup()
        self.on_failed(message)

    def _succeed(self, path) -> None:
        if self._closed:
            return
        self._finished_path = path
        self.cleanup()
        self.on_finished(str(path))

    def _on_load_finished(self, ok) -> None:
        if not ok:
            self._fail("تعذر فتح نسخة السبورة المحفوظة داخل المحرك المضمّن.")
            return
        self._view.page().runJavaScript(BOOTSTRAP_JS, self._on_bootstrap)

    def _on_bootstrap(self, payload) -> None:
        data = parse_js_json(payload)
        if not data.get("started"):
            reason = str(data.get("reason") or "").strip()
            self._fail(reason or "تعذر بدء التسجيل في هذه النسخة.")
            return
        self._started = True

    def _poll(self) -> None:
        if time.monotonic() > self._deadline:
            try:
                self._view.page().runJavaScript(CANCEL_JS)
            except Exception:  # noqa: BLE001
                pass
            self._fail("تجاوز التسجيل الحد الأقصى (15 دقيقة)؛ لم يُحفظ فيديو جزئي.")
            return
        try:
            self._view.page().runJavaScript(POLL_JS, self._on_poll_result)
        except Exception:  # noqa: BLE001 — page is being torn down
            pass

    def _on_poll_result(self, payload) -> None:
        if self._closed:
            return
        data = parse_js_json(payload)
        progress = float(data.get("progress") or 0.0)
        status = str(data.get("status") or "")
        if progress > 0 or status:
            self.on_progress(max(0.0, min(progress, 1.0)), status)
        if self._started and classify_status(status) == "failed":
            # The page already aborted itself and will not download anything.
            self._fail(status)

    def _on_download_requested(self, request) -> None:
        name = "NovaVoice-lesson.webm"
        try:
            suggested = str(request.suggestedFileName() or "").strip()
            if suggested:
                from pathlib import Path

                name = Path(suggested).name or name
        except Exception:  # noqa: BLE001
            pass
        try:
            request.setDownloadDirectory(str(self.staging_dir))
            request.setSuggestedFileName(name)
            request.accept()
        except Exception as error:  # noqa: BLE001
            self._fail(f"تعذر استقبال ملف الفيديو من المحرك المضمّن: {error}")
            return

        def _maybe_done() -> None:
            try:
                if request.isFinished():
                    target = self.staging_dir / name
                    if target.is_file() and target.stat().st_size > 0:
                        self._succeed(target)
                    else:
                        self._fail("لم يكتمل حفظ ملف الفيديو من المحرك المضمّن.")
            except Exception as error:  # noqa: BLE001
                self._fail(f"تعذر استقبال ملف الفيديو: {error}")

        try:
            request.isFinishedChanged.connect(_maybe_done)
        except Exception:  # noqa: BLE001
            _maybe_done()

        # Fallback: poll isFinished in case the signal name differs.
        self._watch_download(request, name)

    def _watch_download(self, request, name) -> None:
        from PySide6.QtCore import QTimer

        attempts = {"n": 0}
        timer = QTimer(self._window)
        timer.setInterval(500)

        def _tick() -> None:
            if self._closed:
                timer.stop()
                return
            attempts["n"] += 1
            try:
                done = request.isFinished()
            except Exception:  # noqa: BLE001
                done = False
            if done or attempts["n"] > 240:  # give up watching after ~2 minutes
                timer.stop()
                if done:
                    target = self.staging_dir / name
                    if target.is_file() and target.stat().st_size > 0:
                        self._succeed(target)
                    else:
                        self._fail("لم يكتمل حفظ ملف الفيديو من المحرك المضمّن.")
                elif not self._closed:
                    self._fail("انقطع حفظ ملف الفيديو؛ لم يُحفظ فيديو جزئي.")

        timer.timeout.connect(_tick)
        timer.start()
