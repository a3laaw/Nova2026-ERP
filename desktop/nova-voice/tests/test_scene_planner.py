"""Cloud boundary tests use injected transport, never a key, account or network."""

import io
import json
from threading import Event
from urllib.error import HTTPError, URLError

import pytest

from nova_voice.scene_planner import (
    ENDPOINT,
    MAX_RESPONSE_BYTES,
    MODEL,
    NETWORK_TIMEOUT,
    _NoRedirect,
    manual_prompt,
    request_plan,
)
from nova_voice.scenes import SceneError, empty_plan
from nova_voice.voices import Cancelled
from nova_voice.whiteboard import parse_lesson

# Deliberately synthetic, not a credential.
FAKE_KEY = "test-only-NOT-A-REAL-KEY"


def source():
    return parse_lesson("# موضوع عام\n## First\nTwo plus three equals five.").manifest()


def result():
    return {
        "model": "example/testing:free",
        "usage": {"cost": 0},
        "choices": [
            {"finish_reason": "stop", "message": {"content": json.dumps(empty_plan(source()))}}
        ],
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


def test_only_one_fixed_free_request_with_no_key_in_prompt_or_result():
    transport = Transport()
    plan = run(transport)
    assert len(transport.calls) == 1
    req, timeout = transport.calls[0]
    assert req.full_url == ENDPOINT and req.get_method() == "POST"
    assert timeout == NETWORK_TIMEOUT
    assert req.get_header("Authorization") == "Bearer " + FAKE_KEY
    assert FAKE_KEY not in req.data.decode()
    data = json.loads(req.data)
    assert data["model"] == MODEL == "openrouter/free"
    assert "models" not in data and "route" not in data and "tools" not in data
    assert data["stream"] is False
    assert data["plugins"] == []
    assert data["provider"] == {
        "allow_fallbacks": False,
        "require_parameters": True,
        "data_collection": "deny",
        "zdr": True,
        "max_price": {"prompt": 0, "completion": 0, "request": 0},
    }
    assert plan.to_data() == empty_plan(source())
    assert FAKE_KEY not in plan.payload_json
    assert transport.response.closed


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
def test_no_request_without_this_lesson_consent_and_adult_eligibility(option):
    transport = Transport()
    with pytest.raises(SceneError):
        run(transport, **option)
    assert transport.calls == []


@pytest.mark.parametrize("key", ["", "short", "bad\r\nX-Injected:true", "a" * 513])
def test_invalid_credentials_never_become_headers_or_logs(key, caplog):
    transport = Transport()
    with pytest.raises(SceneError) as error:
        request_plan(
            source(), key, Event(), lambda _: None, consent=True, adult=True, _transport=transport
        )
    assert transport.calls == []
    assert not caplog.records
    if len(key) > 5:
        assert key not in str(error.value)


def test_manual_prompt_has_source_and_schema_but_no_connection():
    prompt = manual_prompt(source(), "علوم", "إعدادي")
    assert source()["fingerprint"] in prompt
    assert "right_triangle" in prompt and "polygon" in prompt
    assert "الموضوع" not in prompt  # no invented subject/template
    assert "إعدادي" in prompt
    assert FAKE_KEY not in prompt


@pytest.mark.parametrize("status", [301, 302, 307, 308, 400, 401, 402, 403, 429, 500, 503])
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


def test_redirect_handler_does_not_forward_authorization():
    assert (
        _NoRedirect().redirect_request(None, None, 302, "", {}, "https://elsewhere.invalid") is None
    )


@pytest.mark.parametrize(
    "change",
    [
        "paid-model",
        "cost",
        "missing-cost",
        "string-cost",
        "boolean-cost",
        "length",
        "empty-choices",
        "multiple-choices",
        "bad-content",
        "reflected-key",
        "escaped-key",
        "bad-source",
        "unknown-field",
        "error",
        "null-usage",
        "null-message",
    ],
)
def test_untrusted_or_unconfirmed_response_does_not_become_a_plan(change):
    data = result()
    if change == "paid-model":
        data["model"] = "example/testing-paid"
    elif change == "cost":
        data["usage"]["cost"] = 0.001
    elif change == "missing-cost":
        data["usage"] = {}
    elif change == "string-cost":
        data["usage"]["cost"] = "0"
    elif change == "boolean-cost":
        data["usage"]["cost"] = False
    elif change == "length":
        data["choices"][0]["finish_reason"] = "length"
    elif change == "empty-choices":
        data["choices"] = []
    elif change == "multiple-choices":
        data["choices"] *= 2
    elif change == "bad-content":
        data["choices"][0]["message"]["content"] = "<svg/>"
    elif change in ("reflected-key", "escaped-key"):
        plan = empty_plan(source())
        plan["notes"] = [FAKE_KEY]
        text = json.dumps(plan)
        if change == "escaped-key":
            text = text.replace("test-only", "\\u0074est-only")
        data["choices"][0]["message"]["content"] = text
    elif change == "bad-source":
        plan = empty_plan(source())
        plan["source_fingerprint"] = "a" * 64
        data["choices"][0]["message"]["content"] = json.dumps(plan)
    elif change == "unknown-field":
        plan = empty_plan(source())
        plan["javascript"] = "alert(1)"
        data["choices"][0]["message"]["content"] = json.dumps(plan)
    elif change == "error":
        data["error"] = {"message": FAKE_KEY}
    elif change == "null-usage":
        data["usage"] = None
    elif change == "null-message":
        data["choices"][0]["message"] = None
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


def test_cancel_during_read_discards_response():
    cancel, transport = Event(), Transport()
    read = transport.response.read1

    def reader(size):
        block = read(size)
        cancel.set()
        return block

    transport.response.read1 = reader
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
    assert len(transport.calls) == 1 and transport.response.closed


def test_source_must_not_contain_credential_and_large_jobs_stop_before_network():
    transport = Transport()
    for script in (FAKE_KEY, "Hello world. " * 1100):
        lesson = parse_lesson(script)
        with pytest.raises(SceneError):
            request_plan(
                lesson.manifest(),
                FAKE_KEY,
                Event(),
                lambda _: None,
                consent=True,
                adult=True,
                _transport=transport,
            )
    assert transport.calls == []


def test_read_deadline_has_no_automatic_retry(monkeypatch):
    transport = Transport()
    clock = iter([0, 61])
    monkeypatch.setattr("nova_voice.scene_planner.time.monotonic", lambda: next(clock))
    with pytest.raises(SceneError):
        run(transport)
    assert len(transport.calls) == 1 and transport.response.closed
