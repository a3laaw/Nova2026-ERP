import json
import shutil
import socket
from pathlib import Path

import pytest

from nova_voice.voices import VoiceSpec

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Tests and normal app operation must not contact the network")

    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)


@pytest.fixture
def voice_files(tmp_path):
    directory = tmp_path / "original-voice"
    directory.mkdir()
    model = directory / "test_voice.onnx"
    config = directory / "test_voice.onnx.json"
    shutil.copyfile(FIXTURES / model.name, model)
    shutil.copyfile(FIXTURES / config.name, config)
    return model, config


@pytest.fixture
def voice_spec(voice_files):
    return VoiceSpec.from_path(*voice_files)


@pytest.fixture
def bilingual_cast(tmp_path, voice_files):
    from nova_voice.engine import DialogueVoice

    english = VoiceSpec.from_path(*voice_files)
    root = tmp_path / "arabic-voice"
    root.mkdir()
    model = root / "ar_JO-test.onnx"
    config = root / "ar_JO-test.onnx.json"
    shutil.copyfile(english.model_path, model)
    data = json.loads(english.config_path.read_text(encoding="utf-8"))
    data["espeak"]["voice"] = "ar"
    data["language"] = {"code": "ar_JO", "name_native": "العربية"}
    config.write_text(json.dumps(data), encoding="utf-8")
    return {1: DialogueVoice(VoiceSpec.from_path(model)), 2: DialogueVoice(english)}
