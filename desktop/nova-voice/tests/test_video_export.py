"""Qt-free unit tests for the in-system video capture helpers.

The QtWebEngine wiring itself cannot run in headless CI/Linux sandboxes (no
GL); it is exercised on the owner's Windows machine where Qt runs. These
tests pin the contracts that both sides share.
"""

from nova_voice import video_export


def test_is_exportable_main_accepts_html_only():
    assert video_export.is_exportable_main("lesson.html")
    assert video_export.is_exportable_main("Lesson-01.HTM")
    assert video_export.is_exportable_main("  padded  name.HtMl  ")
    for rejected in ("lesson.mp4", "lesson.webm", "lesson.pdf", "lesson", "", None, ".html.bak"):
        assert not video_export.is_exportable_main(rejected)


def test_parse_js_json_handles_all_shapes():
    assert video_export.parse_js_json('{"started": true}') == {"started": True}
    assert video_export.parse_js_json({"started": False, "reason": "x"})["reason"] == "x"
    assert video_export.parse_js_json("not json") == {}
    assert video_export.parse_js_json("[1, 2]") == {}
    assert video_export.parse_js_json(None) == {}
    assert video_export.parse_js_json(42) == {}


def test_classify_status_running_success_failed():
    assert video_export.classify_status("") == "running"
    assert video_export.classify_status("جارٍ التصدير محليًا · الخطوة 1 من 10 · 12%") == "running"
    status_success = "طُلب تنزيل فيديو WEBM بالصوت المضمّن. افتحه للتحقق."
    assert video_export.classify_status(status_success) == "success"
    assert video_export.classify_status("تعذّر ترميز الفيديو بهذا المتصفح. جرّب WebM.") == "failed"
    assert video_export.classify_status("أُلغي التصدير؛ لم يُنزّل فيديو جزئي.") == "failed"
    hidden_status = "توقف التصدير لأن الصفحة أصبحت مخفية؛ لم يُنزّل فيديو جزئي."
    assert video_export.classify_status(hidden_status) == "failed"
    assert video_export.classify_status("تجاوز التصدير حد الوقت التجريبي") == "failed"
    assert video_export.classify_status("الفيديو غير متاح لبيانات صوت غير مكتملة") == "failed"
    assert video_export.classify_status("لم ينتج المتصفح إطارات فيديو.") == "failed"
    assert video_export.classify_status(None) == "running"


def test_bootstrap_js_targets_review_and_video_button():
    assert "wb-output-review" in video_export.BOOTSTRAP_JS
    assert "wb-video" in video_export.BOOTSTRAP_JS
    assert "JSON.stringify" in video_export.BOOTSTRAP_JS
    # Never auto-confirm un-reviewable exports: the review checkbox is checked
    # programmatically only after the user confirms in the app dialog.
    assert "started" in video_export.BOOTSTRAP_JS


def test_poll_and_cancel_js_are_self_contained():
    assert "wb-video-progress" in video_export.POLL_JS
    assert "wb-output-status" in video_export.POLL_JS
    assert "wb-video-cancel" in video_export.CANCEL_JS
    assert "novaExporting" in video_export.POLL_JS


def test_success_marker_matches_page():
    # assets/whiteboard-output.js ends a successful export with this phrase.
    assert video_export._SUCCESS_MARKER in "طُلب تنزيل فيديو WEBM بالصوت المضمّن."


def test_failure_markers_cover_page_guards():
    # Every early-return guard in assets/whiteboard-output.js surface text.
    for marker in (
        "اترك الصفحة ظاهرة",
        "تجاوز",
        "تعذّر",
        "لم يبدأ",
        "لم يُنهِ",
        "لم ينتج",
        "الفيديو غير متاح",
        "المتصفح لا يدعم",
        "تأخر",
        "غير متاح",
        "توقف",
        "الجهاز",
        "أُلغي",
        "لم يُنزّل",
        "مدة/ذاكرة",
    ):
        assert marker in video_export._FAILURE_MARKERS


def test_capture_limit_covers_page_limit():
    # Page self-limits at 15 minutes (MAX_SECONDS); watchdog must outlive it.
    assert video_export.MAX_CAPTURE_SECONDS >= 15 * 60
