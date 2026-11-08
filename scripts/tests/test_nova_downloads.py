"""Workspace delivery tests; not bundled into the independent desktop app."""

import importlib.util
import json
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

spec = importlib.util.spec_from_file_location(
    "nova_delivery", Path(__file__).parents[1] / "serve-nova-downloads.py"
)
delivery_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delivery_module)


@pytest.fixture
def site(tmp_path):
    output = tmp_path / "deliverables" / "nova-voice"
    source = tmp_path / "desktop" / "nova-voice"
    output.mkdir(parents=True)
    (source / "examples").mkdir(parents=True)
    archive = output / delivery_module.ARCHIVE_NAME
    archive.write_bytes(b"Rar!\x1a\x07\x00" + bytes(range(256)))
    (output / "index.html").write_text("<h1>Download centre</h1>")
    (output / "RUN-FIRST-AR.html").write_text("<h1>Guide</h1>")
    (output / "SHA256SUMS.txt").write_text("test checksum")
    (source / "examples" / "greetings-whiteboard.html").write_text(
        "<h1>Board preview</h1>"
    )
    (source / "examples" / "greetings-kids.html").write_text("<h1>Kids preview</h1>")
    for name in (
        "HTML-GUIDE.md",
        "WHITEBOARD-GUIDE.md",
        "KIDS-GUIDE-AR.md",
        "EGYPTIAN-VOICES-AR.md",
        "BRITISH-ENGLISH-AR.md",
        "FINAL-RELEASE-AR.md",
    ):
        (source / name).write_text("Public guide")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("not public")
    server = ThreadingHTTPServer(
        ("0.0.0.0", 0), partial(delivery_module.DeliveryHandler, repository=tmp_path)
    )
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", archive
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_download_is_a_real_attachment_and_head_matches_its_bytes(site):
    base, archive = site
    url = base + "/" + archive.name
    with urlopen(url, timeout=3) as response:
        assert response.status == 200
        assert response.headers["Content-Type"] == "application/vnd.rar"
        assert (
            response.headers["Content-Disposition"]
            == f'attachment; filename="{archive.name}"'
        )
        assert response.headers["Cache-Control"] == "no-store"
        assert response.read() == archive.read_bytes()
    with urlopen(Request(url, method="HEAD"), timeout=3) as response:
        assert int(response.headers["Content-Length"]) == archive.stat().st_size
        assert response.read() == b""


def test_one_site_serves_download_page_guide_and_the_board_preview(site):
    base, _ = site
    for path, content in (
        ("/", b"Download centre"),
        ("/RUN-FIRST-AR.html", b"Guide"),
        ("/desktop/nova-voice/examples/greetings-whiteboard.html", b"Board preview"),
        ("/desktop/nova-voice/WHITEBOARD-GUIDE.md", b"Public guide"),
        ("/preview-kids", b"Kids preview"),
        ("/desktop/nova-voice/examples/greetings-kids.html", b"Kids preview"),
        ("/desktop/nova-voice/KIDS-GUIDE-AR.md", b"Public guide"),
    ):
        with urlopen(base + path, timeout=3) as response:
            assert response.status == 200
            assert content in response.read()


@pytest.mark.parametrize(
    "path",
    [
        "/.git/config",
        "/..%2f..%2f.git/config",
        "/deliverables/",
        "/desktop/nova-voice/run.py",
    ],
)
def test_server_never_exposes_repository_files_or_directory_lists(site, path):
    base, _ = site
    with pytest.raises(HTTPError) as error:
        urlopen(base + path, timeout=3)
    assert error.value.code == 404


def test_missing_archive_is_reported_not_a_false_working_download(site):
    base, archive = site
    archive.unlink()
    with pytest.raises(HTTPError) as error:
        urlopen(base + "/", timeout=3)
    assert error.value.code == 503
    with pytest.raises(HTTPError) as error:
        urlopen(base + "/healthz", timeout=3)
    assert error.value.code == 503
    assert json.loads(error.value.read())["ready"] is False
    with pytest.raises(HTTPError) as error:
        urlopen(base + "/" + archive.name, timeout=3)
    assert error.value.code == 404


def test_health_confirms_the_exact_available_filename(site):
    base, archive = site
    with urlopen(base + "/healthz", timeout=3) as response:
        assert json.loads(response.read()) == {"ready": True, "archive": archive.name}


def test_egyptian_voice_report_is_explicitly_public_not_the_rest_of_the_source(site):
    base, _ = site
    with urlopen(
        base + "/desktop/nova-voice/EGYPTIAN-VOICES-AR.md", timeout=3
    ) as response:
        assert response.status == 200
        assert response.headers["Content-Type"] == "text/plain; charset=utf-8"
        assert response.read() == b"Public guide"


@pytest.mark.parametrize("name", ["BRITISH-ENGLISH-AR.md", "FINAL-RELEASE-AR.md"])
def test_final_release_guides_are_public_without_exposing_the_source(site, name):
    base, _ = site
    with urlopen(base + "/desktop/nova-voice/" + name, timeout=3) as response:
        assert response.status == 200
        assert response.headers["Content-Type"] == "text/plain; charset=utf-8"
        assert response.read() == b"Public guide"
