"""One local preview for Nova Voice downloads, setup guide and silent board demo.

This is a workspace delivery helper, NOT a runtime dependency of the desktop app.
It serves a fixed public allowlist, never the repository tree or directory lists.
"""

import argparse
import json
import os
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ARCHIVE_NAME = "NovaVoice-Source-v0.6.0.rar"


def public_routes(repository: Path) -> dict[str, tuple[Path, str, bool]]:
    delivery = repository / "deliverables" / "nova-voice"
    source = repository / "desktop" / "nova-voice"
    html = "text/html; charset=utf-8"
    routes = {
        "/": (delivery / "index.html", html, False),
        "/index.html": (delivery / "index.html", html, False),
        "/" + ARCHIVE_NAME: (delivery / ARCHIVE_NAME, "application/vnd.rar", True),
        "/RUN-FIRST-AR.html": (delivery / "RUN-FIRST-AR.html", html, False),
        "/SHA256SUMS.txt": (
            delivery / "SHA256SUMS.txt",
            "text/plain; charset=utf-8",
            False,
        ),
        "/preview": (source / "examples" / "greetings-whiteboard.html", html, False),
        "/preview-kids": (source / "examples" / "greetings-kids.html", html, False),
        "/preview-scenes": (source / "examples" / "visual-scenes.html", html, False),
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
    ):
        route = (source / "examples" / name, mime, False)
        routes["/examples/" + name] = route
        routes["/desktop/nova-voice/examples/" + name] = route
    return routes


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
            self._headers(200, mime, size, attachment=attachment)
            if send_body:
                while data := source.read(64 * 1024):
                    self.wfile.write(data)

    def _headers(
        self, status: int, mime: str, size: int, *, attachment: bool = False
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if attachment:
            self.send_header(
                "Content-Disposition", f'attachment; filename="{ARCHIVE_NAME}"'
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
