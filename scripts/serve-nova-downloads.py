"""One local preview for Nova Voice downloads, setup guide and silent board demo.

This is a workspace delivery helper, NOT a runtime dependency of the desktop app.
It serves a fixed public allowlist, never the repository tree or directory lists.
"""

import argparse
import json
import os
import re
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ARCHIVE_NAME = "NovaVoice-Source-v0.17.0.dev1.rar"
GUIDE_NAME = "INFERENCE-GUIDE-v0.17.0.dev1-AR.html"
PDF_NAME = "NovaVoice-Motion-A4-v0.9.0.dev1.pdf"
VIDEO_NAME = "NovaVoice-Motion-H264-v0.9.0.dev1.mp4"
WEBM_NAME = "NovaVoice-Motion-v0.9.0.dev1.webm"


def public_routes(repository: Path) -> dict[str, tuple[Path, str, bool]]:
    delivery = repository / "deliverables" / "nova-voice"
    source = repository / "desktop" / "nova-voice"
    html = "text/html; charset=utf-8"
    routes = {
        "/": (delivery / "index.html", html, False),
        "/index.html": (delivery / "index.html", html, False),
        "/" + ARCHIVE_NAME: (delivery / ARCHIVE_NAME, "application/vnd.rar", True),
        "/RUN-FIRST-AR.html": (delivery / "RUN-FIRST-AR.html", html, False),
        "/inference": (delivery / GUIDE_NAME, html, False),
        "/" + GUIDE_NAME: (delivery / GUIDE_NAME, html, False),
        "/INFERENCE-GUIDE-AR.html": (delivery / "INFERENCE-GUIDE-AR.html", html, False),
        "/desktop/nova-voice/INFERENCE-GUIDE-AR.html": (
            source / "INFERENCE-GUIDE-AR.html",
            html,
            False,
        ),
        "/SHA256SUMS.txt": (
            delivery / "SHA256SUMS.txt",
            "text/plain; charset=utf-8",
            False,
        ),
        "/preview": (source / "examples" / "greetings-whiteboard.html", html, False),
        "/preview-kids": (source / "examples" / "greetings-kids.html", html, False),
        "/preview-scenes": (source / "examples" / "visual-scenes.html", html, False),
        "/preview-full-lesson": (
            source / "examples" / "complete-lesson-demo.html",
            html,
            False,
        ),
        "/preview-output": (
            source / "examples" / "animated-lesson-demo.html",
            html,
            False,
        ),
        "/" + PDF_NAME: (delivery / PDF_NAME, "application/pdf", False),
        "/" + VIDEO_NAME: (delivery / VIDEO_NAME, "video/mp4", False),
        "/" + WEBM_NAME: (delivery / WEBM_NAME, "video/webm", False),
        "/preview-secondary": (
            source / "examples" / "secondary-source-demo.html",
            html,
            False,
        ),
        "/start": (source / "RUN-FIRST-AR.html", html, False),
        "/desktop/nova-voice/RUN-FIRST-AR.html": (
            source / "RUN-FIRST-AR.html",
            html,
            False,
        ),
        "/INFERENCE-GUIDE-v0.14.0.dev1-AR.html": (
            delivery / "INFERENCE-GUIDE-v0.14.0.dev1-AR.html",
            html,
            False,
        ),
        "/INFERENCE-GUIDE-v0.13.0.dev1-AR.html": (
            delivery / "INFERENCE-GUIDE-v0.13.0.dev1-AR.html",
            html,
            False,
        ),
        "/INFERENCE-GUIDE-v0.12.0.dev1-AR.html": (
            delivery / "INFERENCE-GUIDE-v0.12.0.dev1-AR.html",
            html,
            False,
        ),
        "/INFERENCE-GUIDE-v0.11.0.dev1-AR.html": (
            delivery / "INFERENCE-GUIDE-v0.11.0.dev1-AR.html",
            html,
            False,
        ),
        "/preview-composition": (
            source / "examples" / "composition-demo.html",
            html,
            False,
        ),
        "/preview-motion": (
            source / "examples" / "advanced-motion-demo.html",
            html,
            False,
        ),
        "/NovaVoice-Lesson-A4-v0.8.0.dev1.pdf": (
            delivery / "NovaVoice-Lesson-A4-v0.8.0.dev1.pdf",
            "application/pdf",
            False,
        ),
        "/NovaVoice-Animated-Lesson-v0.8.0.dev1.webm": (
            delivery / "NovaVoice-Animated-Lesson-v0.8.0.dev1.webm",
            "video/webm",
            False,
        ),
        "/preview-science": (
            source / "examples" / "water-cycle-whiteboard.html",
            html,
            False,
        ),
        "/desktop/nova-voice/examples/greetings-kids.html": (
            source / "examples" / "greetings-kids.html",
            html,
            False,
        ),
        "/desktop/nova-voice/examples/greetings-whiteboard.html": (
            source / "examples" / "greetings-whiteboard.html",
            html,
            False,
        ),
    }
    for name in (
        "HTML-GUIDE.md",
        "WHITEBOARD-GUIDE.md",
        "KIDS-GUIDE-AR.md",
        "EGYPTIAN-VOICES-AR.md",
        "BRITISH-ENGLISH-AR.md",
        "FINAL-RELEASE-AR.md",
        "SMART-SCENES-AR.md",
        "FULL-LESSON-AR.md",
        "LESSON-OUTPUT-AR.md",
        "VIDEO-MOTION-AR.md",
        "INFERENCE-GUIDE-AR.md",
        "COMPOSITION-MOTION-AR.md",
        "SECONDARY-SOURCES-AR.md",
        "REVIEW-CHOICES-AR.md",
        "SCENE-HISTORY-AR.md",
        "AZURE-SPEECH-AR.md",
        "THIRD_PARTY.md",
    ):
        routes["/desktop/nova-voice/" + name] = (
            source / name,
            "text/plain; charset=utf-8",
            False,
        )
    # Sibling links also work in the separately served RUN-FIRST guide. This
    # remains an explicit allowlist, not a repository/static directory server.
    for name in (
        "HTML-GUIDE.md",
        "WHITEBOARD-GUIDE.md",
        "KIDS-GUIDE-AR.md",
        "EGYPTIAN-VOICES-AR.md",
        "BRITISH-ENGLISH-AR.md",
        "FINAL-RELEASE-AR.md",
        "SMART-SCENES-AR.md",
        "FULL-LESSON-AR.md",
        "LESSON-OUTPUT-AR.md",
        "VIDEO-MOTION-AR.md",
        "INFERENCE-GUIDE-AR.md",
        "COMPOSITION-MOTION-AR.md",
        "SECONDARY-SOURCES-AR.md",
        "REVIEW-CHOICES-AR.md",
        "SCENE-HISTORY-AR.md",
        "AZURE-SPEECH-AR.md",
        "THIRD_PARTY.md",
    ):
        routes["/" + name] = routes["/desktop/nova-voice/" + name]
    for name, mime in (
        ("visual-scenes.html", html),
        ("visual-scenes.json", "application/json; charset=utf-8"),
        ("visual-scenes.txt", "text/plain; charset=utf-8"),
        ("greetings-kids.html", html),
        ("water-cycle-whiteboard.html", html),
        ("water-cycle-plan.json", "application/json; charset=utf-8"),
        ("water-cycle-script.txt", "text/plain; charset=utf-8"),
        ("water-cycle-description.txt", "text/plain; charset=utf-8"),
        ("SCIENCE-TEST-AR.md", "text/plain; charset=utf-8"),
        ("complete-lesson-demo.html", html),
        ("complete-lesson-demo.json", "application/json; charset=utf-8"),
        ("complete-lesson-demo-script.txt", "text/plain; charset=utf-8"),
        ("animated-lesson-demo.html", html),
        ("animated-lesson-demo.json", "application/json; charset=utf-8"),
        ("advanced-motion-demo.html", html),
        ("advanced-motion-demo.json", "application/json; charset=utf-8"),
        ("composition-demo.html", html),
        ("composition-demo.json", "application/json; charset=utf-8"),
        ("composition-demo-script.txt", "text/plain; charset=utf-8"),
        ("secondary-source-demo.html", html),
        ("secondary-source-demo.json", "application/json; charset=utf-8"),
        ("secondary-source-script.txt", "text/plain; charset=utf-8"),
    ):
        route = (source / "examples" / name, mime, False)
        routes["/examples/" + name] = route
        routes["/desktop/nova-voice/examples/" + name] = route
    for legacy in (
        "NovaVoice-Source-v0.14.0.dev1.rar",
        "NovaVoice-Source-v0.13.0.dev1.rar",
        "NovaVoice-Source-v0.12.0.dev1.rar",
        "NovaVoice-Source-v0.11.0.dev1.rar",
        "NovaVoice-Source-v0.10.0.dev1.rar",
        "NovaVoice-Source-v0.9.0.dev1.rar",
        "NovaVoice-Source-v0.8.0.dev1.rar",
        "NovaVoice-Source-v0.7.0.dev1.rar",
        "NovaVoice-Source-v0.6.0.rar",
        "NovaVoice-Source-v0.5.1.rar",
    ):
        routes["/" + legacy] = (delivery / legacy, "application/vnd.rar", True)
    return routes


def byte_range(value: str, size: int) -> tuple[int, int] | None:
    """One bounded HTTP byte range, only for the allowlisted PDF/video samples."""
    if size <= 0 or len(value) > 80:
        return None
    match = re.fullmatch(r"bytes=([0-9]*)-([0-9]*)", value)
    if match is None or not any(match.groups()):
        return None
    first, last = match.groups()
    if not first:
        suffix = int(last)
        return (max(0, size - suffix), size - 1) if suffix > 0 else None
    start = int(first)
    end = min(size - 1, int(last)) if last else size - 1
    return (start, end) if start <= end and start < size else None


class DeliveryHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, repository: Path, **kwargs):
        self.routes = public_routes(repository)
        super().__init__(*args, **kwargs)

    def do_GET(self) -> None:
        self._respond(send_body=True)

    def do_HEAD(self) -> None:
        self._respond(send_body=False)

    def _respond(self, *, send_body: bool) -> None:
        path = unquote(urlsplit(self.path).path)
        if path == "/healthz":
            archive = self.routes["/" + ARCHIVE_NAME][0]
            ready = archive.is_file()
            body = json.dumps({"ready": ready, "archive": ARCHIVE_NAME}).encode()
            self._headers(200 if ready else 503, "application/json", len(body))
            if send_body:
                self.wfile.write(body)
            return
        if (
            path in ("/", "/index.html")
            and not self.routes["/" + ARCHIVE_NAME][0].is_file()
        ):
            body = "ملف RAR غير موجود حاليًا. أعد إنشاء حزمة التسليم قبل نشر رابط التحميل.".encode()
            self._headers(503, "text/plain; charset=utf-8", len(body))
            if send_body:
                self.wfile.write(body)
            return
        route = self.routes.get(path)
        if route is None or not route[0].is_file():
            body = "الملف غير متاح. افتح الصفحة الرئيسية لعرض التسليم الحالي.".encode()
            self._headers(404, "text/plain; charset=utf-8", len(body))
            if send_body:
                self.wfile.write(body)
            return
        file_path, mime, attachment = route
        with file_path.open("rb") as source:
            size = os.fstat(source.fileno()).st_size
            media = mime in ("video/webm", "video/mp4", "application/pdf")
            start, end = 0, size - 1
            range_header = self.headers.get("Range") if media and send_body else None
            if range_header:
                selected = byte_range(range_header, size)
                if selected is None:
                    self._headers(
                        416, mime, 0, content_range=f"bytes */{size}", ranges=True
                    )
                    return
                start, end = selected
            length = max(0, end - start + 1)
            self._headers(
                206 if range_header else 200,
                mime,
                length,
                attachment=file_path.name if attachment else "",
                content_range=f"bytes {start}-{end}/{size}" if range_header else "",
                ranges=media,
            )
            if send_body:
                source.seek(start)
                remaining = length
                while remaining and (data := source.read(min(64 * 1024, remaining))):
                    self.wfile.write(data)
                    remaining -= len(data)

    def _headers(
        self,
        status: int,
        mime: str,
        size: int,
        *,
        attachment: str = "",
        content_range: str = "",
        ranges: bool = False,
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if ranges:
            self.send_header("Accept-Ranges", "bytes")
        if content_range:
            self.send_header("Content-Range", content_range)
        if attachment:
            self.send_header(
                "Content-Disposition", f'attachment; filename="{attachment}"'
            )
        self.end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    repository = Path(__file__).resolve().parents[1]
    archive = repository / "deliverables" / "nova-voice" / ARCHIVE_NAME
    if not archive.is_file():
        parser.error(
            "RAR is missing: run desktop/nova-voice/tools/package_source.py first"
        )
    server = ThreadingHTTPServer(
        ("0.0.0.0", args.port),
        partial(DeliveryHandler, repository=repository),
    )
    print(f"Nova Voice delivery preview listening on 0.0.0.0:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
