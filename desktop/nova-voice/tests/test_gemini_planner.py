"""Cloud boundary tests use injected transport, never a key, account or network.

These tests pin the Gemini (Google AI Studio free tier) contract: one request,
the AI Studio endpoint, ``x-goog-api-key`` only, the key never in the body, and
the same script-protection gates as the OpenRouter path.
"""

import io
import json
from threading import Event
from urllib.error import HTTPError, URLError

import pytest
from test_scene_revision import ModelTransport as OpenRouterModelTransport
from test_scene_revision import alternative

from nova_voice import scene_revision
from nova_voice.gemini_planner import (
    ENDPOINT,
    MAX_RESPONSE_BYTES,
    MODEL,
    NETWORK_TIMEOUT,
    _authorize,
    manual_prompt,
    request_plan,
)
from nova_voice.scene_planner import TOTAL_READ_SECONDS
from nova_voice.scenes import SceneError, empty_plan
from nova_voice.voices import Cancelled
from nova_voice.whiteboard import parse_lesson

# Deliberately synthetic, not a credential.
FAKE_KEY = "AIza-test-only-NOT-A-REAL-KEY"


def source():
    return parse_lesson("# موضوع عام\n## First\nTwo plus three equals five.").manifest()


def result():
    return {
        "modelVersion": MODEL,
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {
                    "role": "model",
                    "parts": [{"text": json.dumps(empty_plan(source()))}],
                },
            }
        ],
        "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 50},
    }


class Response(io.BytesIO):
    status = 200
    headers = {}


class Transport:
    def __init__(self, data=None, raw=None):
        self.calls = []
        self.response = Response(raw if raw is not None else json.dumps(data or result()).encode())

    def __call__(self, request, *, timeout):
        self.calls.append((request, timeout))
        return self.response


def run(transport, **options):
    kwargs = {"consent": True, "adult": True, "_transport": transport} | options
    return request_plan(source(), FAKE_KEY, Event(), lambda _: None, **kwargs)


def test_only_one_request_to_ai_studio_with_key_header_not_bearer_or_body():
    transport = Transport()
    plan = run(transport)
    assert len(transport.calls) == 1
    req, timeout = transport.calls[0]
    assert req.full_url == ENDPOINT and req.get_method() == "POST"
    assert ENDPOINT.endswith(":generateContent")
    assert timeout == NETWORK_TIMEOUT
    assert req.get_header("X-goog-api-key") == FAKE_KEY
    assert req.get_header("Authorization") is None
    assert FAKE_KEY not in req.data.decode()
    data = json.loads(req.data)
    assert data["generationConfig"]["responseMimeType"] == "application/json"
    assert data["generationConfig"]["maxOutputTokens"] >= 4096
    assert "safetySettings" not in data  # provider defaults; never relaxed by the app
    assert FAKE_KEY not in plan.payload_json
    assert transport.response.closed


def test_endpoint_never_uses_openai_compat_or_query_key():
    transport = Transport()
    run(transport)
    req = transport.calls[0][0]
    assert "openai" not in req.full_url
    assert "key=" not in req.full_url


@pytest.mark.parametrize(
    "option",
    [
        {"consent": False},
        {"consent": 1},
        {"adult": False},
        {"adult": 1},
        {"policy": "sacred"},
    ],
)
def test_no_request_without_this_lesson_consent_adult_and_general_policy(option):
    transport = Transport()
    with pytest.raises(SceneError):
        run(transport, **option)
    assert transport.calls == []


@pytest.mark.parametrize("key", ["", "short", "bad\r\nX-Injected:true", "a" * 513, "مفاتيح عربية"])
def test_invalid_credentials_never_become_headers_or_logs(key, caplog):
    transport = Transport()
    with pytest.raises(SceneError):
        request_plan(
            source(),
            key,
            Event(),
            lambda _: None,
            consent=True,
            adult=True,
            _transport=transport,
        )
    assert transport.calls == []
    assert not caplog.records


def test_authorize_accepts_new_style_keys_but_rejects_whitespace():
    cancel = Event()
    _authorize(
        "AQ.Ab8RN6-some_new-style-key.example", cancel, consent=True, adult=True, policy="general"
    )
    with pytest.raises(SceneError):
        _authorize("has space inside", cancel, consent=True, adult=True, policy="general")


def test_manual_prompt_has_source_and_schema_but_no_connection():
    prompt = manual_prompt(source(), "علوم", "إعدادي")
    assert source()["fingerprint"] in prompt
    assert FAKE_KEY not in prompt


@pytest.mark.parametrize("status", [301, 302, 307, 308, 400, 401, 403, 429, 500, 503])
def test_failures_are_sanitized_and_never_retried_or_fall_back(status, caplog):
    calls = []

    def transport(request, **kwargs):
        calls.append(request)
        raise HTTPError(ENDPOINT, status, FAKE_KEY, {}, io.BytesIO(FAKE_KEY.encode()))

    with pytest.raises(SceneError) as error:
        run(transport)
    assert len(calls) == 1
    assert FAKE_KEY not in str(error.value)
    assert not caplog.records


@pytest.mark.parametrize(
    "error", [URLError(FAKE_KEY), TimeoutError(FAKE_KEY), RuntimeError(FAKE_KEY), OSError(FAKE_KEY)]
)
def test_transport_exception_details_cannot_reach_worker_logging(error, caplog):
    def transport(*args, **kwargs):
        raise error

    with pytest.raises(SceneError) as caught:
        run(transport)
    assert FAKE_KEY not in str(caught.value)
    assert not caplog.records


def test_prompt_feedback_block_reason_is_rejected():
    transport = Transport({"promptFeedback": {"blockReason": "SAFETY"}})
    with pytest.raises(SceneError):
        run(transport)
    assert len(transport.calls) == 1


@pytest.mark.parametrize(
    "change",
    [
        "error-envelope",
        "length",
        "empty-candidates",
        "multiple-candidates",
        "missing-parts",
        "multiple-parts",
        "bad-content",
        "reflected-key",
        "bad-source",
        "unknown-field",
        "null-content",
    ],
)
def test_untrusted_or_incomplete_response_does_not_become_a_plan(change):
    data = result()
    if change == "error-envelope":
        data = {"error": {"code": 429, "message": FAKE_KEY, "status": "RESOURCE_EXHAUSTED"}}
    elif change == "length":
        data["candidates"][0]["finishReason"] = "MAX_TOKENS"
    elif change == "empty-candidates":
        data["candidates"] = []
    elif change == "multiple-candidates":
        data["candidates"] *= 2
    elif change == "missing-parts":
        data["candidates"][0]["content"] = {}
    elif change == "multiple-parts":
        data["candidates"][0]["content"]["parts"] *= 2
    elif change == "bad-content":
        data["candidates"][0]["content"]["parts"][0]["text"] = "<svg/>"
    elif change == "reflected-key":
        plan = empty_plan(source())
        plan["notes"] = [FAKE_KEY]
        data["candidates"][0]["content"]["parts"][0]["text"] = json.dumps(plan)
    elif change == "bad-source":
        plan = empty_plan(source())
        plan["source_fingerprint"] = "a" * 64
        data["candidates"][0]["content"]["parts"][0]["text"] = json.dumps(plan)
    elif change == "unknown-field":
        plan = empty_plan(source())
        plan["javascript"] = "alert(1)"
        data["candidates"][0]["content"]["parts"][0]["text"] = json.dumps(plan)
    elif change == "null-content":
        data["candidates"][0]["content"] = None
    transport = Transport(data)
    with pytest.raises(SceneError) as error:
        run(transport)
    assert FAKE_KEY not in str(error.value)
    assert len(transport.calls) == 1


def test_response_has_a_size_limit_and_does_not_leak_body():
    transport = Transport(raw=(b"a" * (MAX_RESPONSE_BYTES + 1)))
    with pytest.raises(SceneError):
        run(transport)
    assert len(transport.calls) == 1 and transport.response.closed


def test_non_json_response_is_safe():
    transport = Transport(raw=FAKE_KEY.encode())
    with pytest.raises(SceneError) as error:
        run(transport)
    assert FAKE_KEY not in str(error.value)


def test_cancel_before_request_does_not_even_create_transport():
    cancel, transport = Event(), Transport()
    cancel.set()
    with pytest.raises(Cancelled):
        request_plan(
            source(),
            FAKE_KEY,
            cancel,
            lambda _: None,
            consent=True,
            adult=True,
            _transport=transport,
        )
    assert not transport.calls


def test_read_deadline_has_no_automatic_retry(monkeypatch):
    transport = Transport()
    clock = iter([0, TOTAL_READ_SECONDS + 1])
    monkeypatch.setattr("nova_voice.gemini_planner.time.monotonic", lambda: next(clock))
    with pytest.raises(SceneError):
        run(transport)
    assert len(transport.calls) == 1 and transport.response.closed


def gemini_envelope(payload):
    return {
        "modelVersion": MODEL,
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {"role": "model", "parts": [{"text": json.dumps(payload)}]},
            }
        ],
    }


class GeminiModelTransport:
    def __init__(self, candidate):
        self.calls = []
        self.payload = gemini_envelope(candidate)

    def __call__(self, req, *, timeout):
        self.calls.append((req, timeout))
        return Response(json.dumps(self.payload).encode())


def test_revision_path_uses_gemini_when_requested(tmp_path):
    req = scene_revision.RevisionRequest(
        source(),
        scene_revision.VisualPlan.from_json(
            json.dumps(empty_plan(source())), source()
        ),
        3,
        "another",
        "another drawing",
        FAKE_KEY,
        True,
        True,
        target_step=None,
        provider="gemini",
    )
    model = GeminiModelTransport(alternative(req.previous))
    result = scene_revision.revise_plan(
        req,
        Event(),
        lambda _: None,
        directory=tmp_path,
        _planner_transport=model,
        _asset_transport=lambda *a, **k: pytest.fail("unexpected artwork request"),
    )
    assert len(model.calls) == 1
    sent = model.calls[0][0]
    assert sent.full_url == ENDPOINT
    assert sent.get_header("X-goog-api-key") == FAKE_KEY
    assert result.model_requested


def test_revision_path_defaults_to_openrouter_envelope(tmp_path):
    req = scene_revision.RevisionRequest(
        source(),
        scene_revision.VisualPlan.from_json(
            json.dumps(empty_plan(source())), source()
        ),
        3,
        "another",
        "another drawing",
        FAKE_KEY,
        True,
        True,
    )
    model = OpenRouterModelTransport(alternative(req.previous))
    result = scene_revision.revise_plan(
        req,
        Event(),
        lambda _: None,
        directory=tmp_path,
        _planner_transport=model,
        _asset_transport=lambda *a, **k: pytest.fail("unexpected artwork request"),
    )
    assert len(model.calls) == 1 and model.calls[0][0].full_url.startswith(
        "https://openrouter.ai/"
    )
    assert result.model_requested


def test_full_lesson_path_uses_gemini_when_requested(tmp_path):
    from pathlib import Path

    from nova_voice.lesson_draft import LessonDraft
    from nova_voice.lesson_planner import request_lesson

    examples = Path(__file__).resolve().parents[1] / "examples"
    fixture = LessonDraft.load(examples / "complete-lesson-demo.json")

    class LessonGeminiTransport:
        def __init__(self):
            self.calls = []
            answer = fixture.to_data()["draft"]
            self.payload = {
                "modelVersion": MODEL,
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "role": "model",
                            "parts": [{"text": json.dumps(answer)}],
                        },
                    }
                ],
            }

        def __call__(self, req, *, timeout):
            self.calls.append((req, timeout))
            return Response(json.dumps(self.payload).encode())

    transport = LessonGeminiTransport()
    draft = request_lesson(
        fixture.brief,
        FAKE_KEY,
        Event(),
        lambda _: None,
        consent=True,
        adult=True,
        provider="gemini",
        _transport=transport,
    )
    assert len(transport.calls) == 1
    sent = transport.calls[0][0]
    assert sent.full_url == ENDPOINT
    assert sent.get_header("X-goog-api-key") == FAKE_KEY
    assert draft is not None


def test_full_lesson_path_rejects_unknown_provider():
    from pathlib import Path

    from nova_voice.lesson_draft import LessonDraft
    from nova_voice.lesson_planner import request_lesson

    examples = Path(__file__).resolve().parents[1] / "examples"
    fixture = LessonDraft.load(examples / "complete-lesson-demo.json")
    with pytest.raises(SceneError):
        request_lesson(
            fixture.brief,
            FAKE_KEY,
            Event(),
            lambda _: None,
            consent=True,
            adult=True,
            provider="openai",
            _transport=Transport(),
        )
