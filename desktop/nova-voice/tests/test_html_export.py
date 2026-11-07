import base64
import re
import wave
from pathlib import Path
from threading import Event
from types import SimpleNamespace

import pytest

from nova_voice.engine import RenderOptions, SpeechEngine
from nova_voice.html_export import (
    BASE64_CHUNK_BYTES,
    HtmlExportError,
    HtmlPage,
    embed_audio,
    render_html,
)
from nova_voice.voices import Cancelled


@pytest.fixture
def html_page(tmp_path):
    source = tmp_path / "درس.html"
    source.write_text(
        '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head>'
        '<body><h1>درس عربي</h1><img src="images/figure.png"><script>const original = 1;</script>'
        "</body></html>",
        encoding="utf-8",
    )
    return source


@pytest.fixture
def audio_file(tmp_path):
    path = tmp_path / "speech.wav"
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(22050)
        audio.writeframes(bytes(4410))
    return path


def embedded_bytes(path):
    content = path.read_text(encoding="utf-8-sig")
    match = re.search(r'data:(audio/[^;]+);base64,([A-Za-z0-9+/=]+)"', content)
    assert match is not None
    return match.group(1), base64.b64decode(match.group(2), validate=True)


def test_audio_is_embedded_in_a_new_html_file_without_changing_source(html_page, audio_file):
    original = html_page.read_bytes()
    output = html_page.with_name("lesson-with-voice.html")
    progress = []
    embed_audio(HtmlPage.load(html_page), audio_file, output, progress=progress.append)
    assert html_page.read_bytes() == original
    assert embedded_bytes(output) == ("audio/wav", audio_file.read_bytes())
    content = output.read_text(encoding="utf-8-sig")
    assert '<img src="images/figure.png">' in content
    assert "<script>const original = 1;</script>" in content
    assert content.index("<nova-voice-player") < content.rindex("</body>")
    assert content.count("<nova-voice-player") == 1
    assert "autoplay" not in content.split("</audio>")[0]
    assert "__NOVA_PLAYER_CSS__" not in content
    assert progress[-1] == 100
    assert not list(output.parent.glob(".nova-html-*"))


@pytest.mark.parametrize("encoding", ["utf-8", "utf-8-sig", "utf-16"])
def test_unicode_html_is_output_as_utf8_with_bom(tmp_path, audio_file, encoding):
    path = tmp_path / "source.html"
    path.write_bytes(
        '<html><head><meta charset="windows-1256"></head><body>أهلًا</body></html>'.encode(encoding)
    )
    before = path.read_bytes()
    output = tmp_path / "copy.html"
    embed_audio(HtmlPage.load(path), audio_file, output)
    assert output.read_bytes().startswith(b"\xef\xbb\xbf")
    assert "أهلًا" in output.read_text(encoding="utf-8-sig")
    assert path.read_bytes() == before


@pytest.mark.parametrize(
    "content",
    [
        '<html><body><script>const x = "</body>";</script><p>End</p></body></html>',
        "<html><body><!-- </body> --><p>End</p></body></html>",
        "<html><body><template><body>inert</body></template><p>End</p></body></html>",
        "<html><body><noscript><body>inert</body></noscript><p>End</p></body></html>",
        "<html><body><textarea>literal </body></textarea><p>End</p></body></html>",
        "<html><body><svg/><p>End</p></body></html>",
    ],
)
def test_insertion_uses_real_body_end_not_comments_scripts_or_inert_content(
    tmp_path,
    audio_file,
    content,
):
    source = tmp_path / "page.html"
    source.write_text(content)
    page = HtmlPage.load(source)
    assert page.insertion_offset == content.rindex("</body>")
    output = tmp_path / "result.html"
    embed_audio(page, audio_file, output)
    result = output.read_text(encoding="utf-8-sig")
    assert result.startswith(content[: page.insertion_offset])
    assert result.endswith(content[page.insertion_offset :])


@pytest.mark.parametrize(
    "content", ["<p>Fragment</p>", "<html><head></head><p>No body end.</p></html>"]
)
def test_fragments_and_missing_body_tag_have_a_fallback(tmp_path, audio_file, content):
    source = tmp_path / "page.htm"
    source.write_text(content)
    output = tmp_path / "result.htm"
    embed_audio(HtmlPage.load(source), audio_file, output)
    assert embedded_bytes(output)[1] == audio_file.read_bytes()


@pytest.mark.parametrize("policy", ["default-src 'self'", "script-src 'none'; media-src 'none'"])
def test_csp_is_never_silently_removed_or_weakened(tmp_path, policy):
    source = tmp_path / "strict.html"
    content = (
        f'<html><head><meta http-equiv="Content-Security-Policy" content="{policy}">'
        "</head><body>Hi</body></html>"
    )
    source.write_text(content)
    with pytest.raises(HtmlExportError, match="CSP"):
        HtmlPage.load(source)
    assert source.read_text() == content


def test_inert_csp_does_not_block_and_previous_player_is_detected(tmp_path):
    source = tmp_path / "page.html"
    source.write_text(
        '<body><template><meta http-equiv="Content-Security-Policy" '
        'content="default-src none"></template></body>'
    )
    HtmlPage.load(source)
    source.write_text(
        '<body><nova-voice-player data-nova-voice-player="0.3.0"></nova-voice-player></body>'
    )
    with pytest.raises(HtmlExportError, match="الأصلي"):
        HtmlPage.load(source)


@pytest.mark.parametrize(
    "content",
    [
        "<body><script>unclosed",
        "<body><style>unclosed",
        "<body><textarea>unclosed",
        "<plaintext>never ends",
    ],
)
def test_unclosed_raw_text_cannot_swallow_the_added_player(tmp_path, content):
    source = tmp_path / "page.html"
    source.write_text(content)
    with pytest.raises(HtmlExportError):
        HtmlPage.load(source)


def test_bad_encoding_empty_and_non_html_inputs_are_reported(tmp_path):
    source = tmp_path / "page.html"
    for content in [b"", b"\x00binary", b"\xff\x80not utf8"]:
        source.write_bytes(content)
        with pytest.raises(HtmlExportError):
            HtmlPage.load(source)
    wrong = tmp_path / "page.txt"
    wrong.write_text("Hello")
    with pytest.raises(HtmlExportError):
        HtmlPage.load(wrong)


def test_original_cannot_be_overwritten_even_through_a_symlink(html_page, audio_file):
    page = HtmlPage.load(html_page)
    with pytest.raises(HtmlExportError, match="الأصلي"):
        embed_audio(page, audio_file, html_page)
    alias = html_page.parent / "alias.html"
    try:
        alias.symlink_to(html_page)
    except OSError:
        pytest.skip("Symlink privileges unavailable")
    with pytest.raises(HtmlExportError, match="الأصلي"):
        embed_audio(page, audio_file, alias)


def test_cancellation_cleans_partial_output_and_keeps_previous_result(html_page, audio_file):
    output = html_page.with_name("existing.html")
    output.write_bytes(b"previous complete page")
    cancel = Event()
    with pytest.raises(Cancelled):
        embed_audio(HtmlPage.load(html_page), audio_file, output, cancel, lambda _: cancel.set())
    assert output.read_bytes() == b"previous complete page"
    assert not list(output.parent.glob(".nova-html-*"))


def test_limits_and_unsupported_audio_leave_no_output(html_page, audio_file, monkeypatch):
    output = html_page.with_name("result.html")
    page = HtmlPage.load(html_page)
    monkeypatch.setattr("nova_voice.html_export.MAX_AUDIO_BYTES", 10)
    with pytest.raises(HtmlExportError):
        embed_audio(page, audio_file, output)
    monkeypatch.setattr("nova_voice.html_export.MAX_HTML_BYTES", 10)
    with pytest.raises(HtmlExportError):
        HtmlPage.load(html_page)
    assert not output.exists()


@pytest.mark.parametrize("tail", [0, 1, 2])
def test_streamed_base64_remains_valid_across_chunk_boundaries(tmp_path, html_page, tail):
    audio = tmp_path / "long.mp3"
    raw = b"ID3" + b"a" * (BASE64_CHUNK_BYTES + tail)
    audio.write_bytes(raw)
    output = tmp_path / f"embedded-{tail}.html"
    embed_audio(HtmlPage.load(html_page), audio, output)
    assert embedded_bytes(output) == ("audio/mpeg", raw)


@pytest.mark.parametrize("audio_format", ["mp3", "wav"])
@pytest.mark.parametrize("dialogue", [False, True])
def test_end_to_end_local_render_and_html_export(
    html_page,
    bilingual_cast,
    audio_format,
    dialogue,
):
    output = html_page.with_name(f"render-{audio_format}-{dialogue}.html")
    progress = []
    result = render_html(
        SpeechEngine(),
        html_page,
        "[1] مرحبًا.\n[2] Hello." if dialogue else "مرحبًا.",
        bilingual_cast,
        output,
        RenderOptions(),
        progress=progress.append,
        dialogue=dialogue,
        audio_format=audio_format,
    )
    mime, audio = embedded_bytes(output)
    assert mime == ("audio/mpeg" if audio_format == "mp3" else "audio/wav")
    assert result.audio_bytes == len(audio)
    assert result.path == output
    assert result.duration_seconds > 0
    assert progress[-1] == 100
    assert 85 in progress
    assert audio.startswith(b"RIFF") if audio_format == "wav" else audio[0] == 0xFF


def test_invalid_html_is_rejected_before_synthesizing_audio(tmp_path):
    source = tmp_path / "strict.html"
    source.write_text('<meta http-equiv="Content-Security-Policy" content="default-src none">')
    engine = SimpleNamespace(render=lambda *a, **k: pytest.fail("Should preflight HTML first"))
    with pytest.raises(HtmlExportError):
        render_html(engine, source, "Hi", {}, tmp_path / "out.html", RenderOptions())


def test_pre_cancelled_html_job_does_not_generate_anything(tmp_path):
    event = Event()
    event.set()
    with pytest.raises(Cancelled):
        render_html(
            None, tmp_path / "missing.html", "Hi", {}, tmp_path / "out.html", RenderOptions(), event
        )
    assert not (tmp_path / "out.html").exists()


def test_expanding_home_cannot_overwrite_the_original(html_page, audio_file, monkeypatch):
    monkeypatch.setenv("HOME", str(html_page.parent))
    monkeypatch.setenv("USERPROFILE", str(html_page.parent))
    with pytest.raises(HtmlExportError, match="الأصلي"):
        embed_audio(HtmlPage.load(html_page), audio_file, Path("~") / html_page.name)
