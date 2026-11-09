"""Mocked complete-lesson transport only: never a real provider/account/key."""

import io
import json
from pathlib import Path
from threading import Event
from urllib.error import HTTPError

import pytest

from nova_voice.lesson_draft import LessonDraft
from nova_voice.lesson_planner import manual_prompt, request_lesson
from nova_voice.scene_planner import ENDPOINT, MODEL
from nova_voice.text import ScriptError

KEY = "synthetic-only-NOT-A-REAL-KEY"
EXAMPLES = Path(__file__).parents[1] / "examples"


class Response(io.BytesIO):
    status = 200
    headers = {}


def fixture():
    return LessonDraft.load(EXAMPLES / "complete-lesson-demo.json")


class Transport:
    def __init__(self, answer=None, *, model=MODEL, cost=0, status=None):
        self.calls = []
        self.status = status
        data = {
            "model": model,
            "usage": {"cost": cost},
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {
                        "content": answer
                        if answer is not None
                        else json.dumps(fixture().to_data()["draft"])
                    },
                }
            ],
        }
        self.response = Response(json.dumps(data).encode())

    def __call__(self, request, *, timeout):
        self.calls.append((request, timeout))
        if self.status:
            raise HTTPError(ENDPOINT, self.status, KEY, {}, io.BytesIO(KEY.encode()))
        return self.response


def run(transport, **options):
    return request_lesson(
        fixture().brief,
        KEY,
        Event(),
        lambda _: None,
        **({"consent": True, "adult": True, "_transport": transport} | options),
    )


def test_one_request_expands_short_brief_to_full_local_lesson_not_a_source_bound_one_row_plan():
    transport = Transport()
    draft = run(transport)
    assert draft == fixture() and len(draft.compile().steps) == 10
    assert len(transport.calls) == 1
    request, timeout = transport.calls[0]
    assert request.full_url == ENDPOINT and timeout == 20
    payload = json.loads(request.data)
    assert payload["model"] == MODEL == "openrouter/free"
    assert payload["provider"] == {
        "allow_fallbacks": False,
        "require_parameters": True,
        "data_collection": "deny",
        "zdr": True,
        "max_price": {"prompt": 0, "completion": 0, "request": 0},
    }
    assert payload["plugins"] == [] and payload["stream"] is False
    assert "original_brief" in payload["messages"][1]["content"]
    assert "source_lesson" not in payload["messages"][1]["content"]
    assert KEY not in request.data.decode() and KEY not in draft.payload_json
    assert transport.response.closed


def test_manual_prompt_explicitly_expands_but_does_not_send_anything():
    prompt = manual_prompt(fixture().brief)
    assert "EXPANDS" in prompt and "objectives" in prompt and "questions" in prompt
    assert "right_triangle" in prompt and "polygon" in prompt
    assert fixture().brief.fingerprint in prompt and KEY not in prompt


@pytest.mark.parametrize(
    "options", [{"consent": False}, {"adult": False}, {"adult": 1}, {"policy": "sacred"}]
)
def test_missing_consent_eligibility_or_protected_mode_never_sends(options):
    transport = Transport()
    with pytest.raises(ScriptError):
        run(transport, **options)
    assert transport.calls == []


@pytest.mark.parametrize(
    "change",
    [
        "paid",
        "cost",
        "missing-cost",
        "bad-json",
        "schema",
        "wrong-brief",
        "missing-questions",
        "no-illustrations",
        "reflected-key",
        "escaped-key",
    ],
)
def test_bad_full_lesson_stops_after_one_attempt_without_repair_or_paid_fallback(change):
    raw = fixture().to_data()["draft"]
    options = {}
    if change == "paid":
        options["model"] = "example/model-paid"
    elif change == "cost":
        options["cost"] = 0.0001
    elif change == "missing-cost":
        options["cost"] = None
    elif change == "schema":
        raw["schema"] = 99
    elif change == "wrong-brief":
        raw["brief_fingerprint"] = "0" * 64
    elif change == "missing-questions":
        raw["questions"] = []
    elif change == "no-illustrations":
        raw["steps"][0]["elements"] = []
    elif change in ("reflected-key", "escaped-key"):
        raw["notes"].append(KEY)
    answer = json.dumps(raw)
    if change == "bad-json":
        answer = "<script>bad()</script>"
    if change == "escaped-key":
        answer = answer.replace("synthetic-only", "\\u0073ynthetic-only")
    transport = Transport(answer, **options)
    with pytest.raises(ScriptError) as error:
        run(transport)
    assert len(transport.calls) == 1 and KEY not in str(error.value)


@pytest.mark.parametrize("status", [301, 302, 401, 402, 403, 429, 500])
def test_full_lesson_failures_do_not_echo_headers_or_retry(status, caplog):
    transport = Transport(status=status)
    with pytest.raises(ScriptError) as error:
        run(transport)
    assert len(transport.calls) == 1 and KEY not in str(error.value)
    assert caplog.records == []


@pytest.mark.parametrize("change", ["cost", "model", "choices", "nonfinite"])
def test_ambiguous_provider_envelope_cannot_hide_paid_or_incomplete_metadata(change):
    transport = Transport()
    raw = transport.response.getvalue().decode()
    if change == "cost":
        raw = raw.replace('"cost": 0', '"cost": 1, "cost": 0', 1)
    elif change == "model":
        raw = raw.replace('"model": ', '"model": "paid/model", "model": ', 1)
    elif change == "choices":
        raw = raw.replace('"choices": ', '"choices": null, "choices": ', 1)
    else:
        raw = '{"unrelated_metric":NaN,' + raw[1:]
    transport.response = Response(raw.encode())
    with pytest.raises(ScriptError) as error:
        run(transport)
    assert len(transport.calls) == 1 and KEY not in str(error.value)
    assert transport.response.closed
