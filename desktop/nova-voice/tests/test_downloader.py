import hashlib
import importlib.util
import io
import json
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "download_voice.py"
SPEC = importlib.util.spec_from_file_location("voice_downloader", SCRIPT)
downloader = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(downloader)


class Response(io.BytesIO):
    def __init__(self, data, declared_length=None):
        super().__init__(data)
        self.headers = {
            "Content-Length": str(declared_length if declared_length is not None else len(data))
        }


@pytest.fixture(params=["ar_JO-kareem-medium", "en_US-lessac-medium", "en_US-amy-medium"])
def remote(monkeypatch, voice_files, request):
    model, config = voice_files
    voice = request.param
    prefix = downloader.VOICE_PATHS[voice]
    files = {
        prefix + voice + ".onnx": model.read_bytes(),
        prefix + voice + ".onnx.json": config.read_bytes(),
        prefix + "MODEL_CARD": b"Test license card",
    }
    metadata = {
        path: {"size_bytes": len(data), "md5_digest": hashlib.md5(data).hexdigest()}
        for path, data in files.items()
    }
    files["voices.json"] = json.dumps({voice: {"files": metadata}}).encode()

    def open_url(url, timeout):
        key = url.removeprefix(downloader.BASE_URL).split("?")[0]
        return Response(files[key])

    monkeypatch.setattr(downloader, "urlopen", open_url)
    return voice, files


def test_verified_atomic_model_setup(tmp_path, remote):
    voice, _ = remote
    destination = downloader.download_voice(voice, tmp_path / "voices")
    assert (destination / f"{voice}.onnx").is_file()
    assert (destination / f"{voice}.onnx.json").is_file()
    assert (destination / "MODEL_CARD").is_file()
    assert downloader.download_voice(voice, tmp_path / "voices") == destination


def test_bad_checksum_leaves_no_installed_voice(tmp_path, remote):
    voice, files = remote
    files[downloader.VOICE_PATHS[voice] + voice + ".onnx"] = b"corrupt"
    with pytest.raises(ValueError):
        downloader.download_voice(voice, tmp_path / "voices")
    assert list((tmp_path / "voices").iterdir()) == []


def test_truncated_http_response_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(
        downloader, "urlopen", lambda *a, **k: Response(b"short", declared_length=20)
    )
    with pytest.raises(ValueError, match="Truncated"):
        downloader.download_file("https://example.invalid/test", tmp_path / "file")


def test_unapproved_voice_is_rejected_without_network(tmp_path):
    with pytest.raises(ValueError):
        downloader.download_voice("../../bad", tmp_path)
