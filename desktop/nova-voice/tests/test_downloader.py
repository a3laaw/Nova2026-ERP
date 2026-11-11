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


@pytest.fixture(params=list(downloader.VOICE_PATHS))
def remote(monkeypatch, voice_files, request):
    model, config = voice_files
    voice = request.param
    prefix = downloader.VOICE_PATHS[voice]
    code = voice.split("-", 1)[0]
    configuration = json.loads(config.read_text(encoding="utf-8"))
    configuration["language"] = {
        "code": code,
        "name_native": "العربية" if code == "ar_JO" else "English",
    }
    configuration["espeak"]["voice"] = {
        "ar_JO": "ar",
        "en_US": "en-us",
        "en_GB": "en-gb-x-rp" if "alan" in voice else "en",
    }[code]
    files = {
        prefix + voice + ".onnx": model.read_bytes(),
        prefix + voice + ".onnx.json": json.dumps(configuration).encode(),
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
    from nova_voice.voices import VoiceSpec

    assert (
        VoiceSpec.from_path(destination / f"{voice}.onnx").language_code == voice.split("-", 1)[0]
    )
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


@pytest.mark.parametrize(
    "choice,first,second",
    [
        ("1", "en_GB-alan-medium", "en_GB-cori-medium"),
        ("2", "en_GB-cori-medium", "en_GB-alan-medium"),
        ("3", "en_US-lessac-medium", "en_US-amy-medium"),
        ("4", "en_US-amy-medium", "en_US-lessac-medium"),
    ],
)
@pytest.mark.parametrize("additional", ["n", "Y"])
def test_english_menu_requires_a_choice_and_only_downloads_the_requested_group(
    tmp_path, monkeypatch, choice, first, second, additional, capsys
):
    answers = iter([choice, additional])
    calls = []
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    monkeypatch.setattr(
        downloader, "download_voice", lambda voice, output: calls.append((voice, output))
    )
    output = tmp_path / "voices"
    assert downloader.main(["--english-setup", "--output", str(output)]) == 0
    assert calls == [
        (voice, output) for voice in ([first, second] if additional == "Y" else [first])
    ]
    text = capsys.readouterr().out
    assert text.index("Alan - UK") < text.index("Lessac - US")
    assert "NOT a listening or voice-quality guarantee" in text
    assert not output.exists()


@pytest.mark.parametrize("answers", [["q"], ["", "invalid", "Q"]])
def test_english_menu_cancel_or_invalid_input_never_defaults_to_a_voice(
    tmp_path, monkeypatch, answers
):
    replies = iter(answers)
    monkeypatch.setattr("builtins.input", lambda _: next(replies))
    monkeypatch.setattr(
        downloader, "download_voice", lambda *args: pytest.fail("No approved choice")
    )
    assert downloader.setup_english(tmp_path / "voices") == 0
    assert not (tmp_path / "voices").exists()


def test_english_menu_closed_input_does_not_download(tmp_path, monkeypatch):
    def closed(_):
        raise EOFError()

    monkeypatch.setattr("builtins.input", closed)
    monkeypatch.setattr(
        downloader, "download_voice", lambda *args: pytest.fail("No approved choice")
    )
    assert downloader.setup_english(tmp_path / "voices") == 0


def test_explicit_voice_and_interactive_setup_are_mutually_exclusive(monkeypatch):
    monkeypatch.setattr(downloader, "download_voice", lambda *args: pytest.fail("No network"))
    with pytest.raises(SystemExit) as error:
        downloader.main(["en_US-lessac-medium", "--english-setup"])
    assert error.value.code == 2


def test_english_batch_only_delegates_to_the_explicit_interactive_setup():
    text = (SCRIPT.parent.parent / "Download-English-Voice.bat").read_text(encoding="utf-8")
    assert "--english-setup --output voices" in text
    assert "tools\\download_voice.py en_US-" not in text
    assert "if errorlevel 1 goto failed" in text
