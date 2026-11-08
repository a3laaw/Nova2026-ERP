"""Static delivery-page contracts; no frontend runtime or external network required."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

import pytest

PAGE = Path(__file__).parents[2] / "deliverables" / "nova-voice" / "index.html"


class Elements(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


@pytest.fixture
def document():
    return Elements(PAGE.read_text(encoding="utf-8"))


def test_delivery_is_arabic_with_one_main_heading_and_one_primary_download(document):
    assert next(attrs for tag, attrs in document.tags if tag == "html") == {
        "lang": "ar",
        "dir": "rtl",
    }
    assert sum(tag == "h1" for tag, _ in document.tags) == 1
    downloads = [
        attrs for tag, attrs in document.tags if tag == "a" and "download" in attrs
    ]
    assert len(downloads) == 1
    assert (
        downloads[0]["href"]
        == downloads[0]["download"]
        == "NovaVoice-Source-v0.5.1.rar"
    )
    assert "primary" in downloads[0]["class"].split()


def test_every_internal_shortcut_has_one_unique_target(document):
    ids = [attrs["id"] for _, attrs in document.tags if "id" in attrs]
    assert len(ids) == len(set(ids))
    assert {"download", "setup", "preview", "egyptian"}.issubset(ids)
    for tag, attrs in document.tags:
        if tag == "a" and attrs.get("href", "").startswith("#"):
            assert attrs["href"][1:] in ids


def test_delivery_needs_no_remote_font_image_script_or_embedded_service(document):
    for tag, attrs in document.tags:
        assert tag not in {"iframe", "script", "link", "img", "audio"}
        assert (
            "style" not in attrs
        )  # Presentation is collected in the local stylesheet.


def test_every_relative_file_link_points_to_an_existing_deliverable_or_guide(document):
    for tag, attrs in document.tags:
        href = attrs.get("href", "")
        if tag != "a" or not href or href.startswith("#") or urlsplit(href).scheme:
            continue
        assert (PAGE.parent / urlsplit(href).path).resolve().is_file(), href


def test_egyptian_research_is_clear_about_no_installed_voice_or_hardware_proof():
    text = PAGE.read_text(encoding="utf-8")
    assert "غير مضافة إلى البرنامج" in text
    assert "لم تُنزّل أوزانهما" in text
    assert "4 جيجا" in text
    assert "EGYPTIAN-VOICES-AR.md" in text
    assert "VoiceTut-TTS" in text and "NAMAA-Egyptian-TTS" in text
    assert "مصدر وملفات تشغيل، وليس EXE جاهزًا" in text
