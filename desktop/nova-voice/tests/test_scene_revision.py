"""Review-choice orchestration with injected transports, not live understanding."""

import io
import json
from dataclasses import replace
from pathlib import Path
from threading import Event
from urllib.error import HTTPError

import pytest
from test_secondary_assets import BlobTransport, element, raw

from nova_voice import scene_revision as revision
from nova_voice.lesson_draft import LessonDraft
from nova_voice.scene_planner import ENDPOINT, MODEL, NETWORK_TIMEOUT
from nova_voice.scene_revision import (
    ReviewCredential,
    RevisionRequest,
    needs_planner,
    revise_plan,
    revision_matches,
    revision_prompt,
)
from nova_voice.scenes import SceneError, VisualPlan, empty_plan
from nova_voice.secondary_assets import normalize_svg
from nova_voice.voices import Cancelled
from nova_voice.whiteboard import WhiteboardPage, parse_lesson, save_whiteboard

ROOT = Path(__file__).resolve().parents[1]
FAKE_KEY = "test-only-NOT-A-REAL-KEY"


def source():
    return parse_lesson("# Source\nFirst cue.\nSecond cue.\nLast cue.").manifest()


def original():
    data = empty_plan(source(), subject="علوم", grade="الإعدادي")
    data["steps"][0]["elements"] = [dict(kind="circle", row=0, x=160, y=160, r=50, fill="#2563eb")]
    data["steps"][0]["rows"] = [dict(index=0, display="عرض مراجع", speech="نطق مراجع.")]
    return VisualPlan.from_data(data, source())


def alternative(previous=None, *, asset_id=None):
    data = (previous or original()).to_data()
    data.pop("resources", None)
    data.pop("origin", None)
    data["schema"] = 1
    if asset_id:
        e = element()
        e["asset_id"] = asset_id
    else:
        e = dict(kind="rect", row=0, x=160, y=160, w=100, h=80, fill="#ffb000")
    data["steps"][0]["elements"] = [e]
    return data


def request(action="another", previous=None, manifest=None, **options):
    defaults = dict(
        key=FAKE_KEY, adult=True, send_consent=True, download_consent=action == "external"
    )
    return RevisionRequest(
        manifest or source(), previous or original(), 7, action, **(defaults | options)
    )


class Response(io.BytesIO):
    status = 200
    headers = {}


class ModelTransport:
    def __init__(self, candidate=None, *, change=None, cancel=None):
        self.calls = []
        self.cancel = cancel
        payload = {
            "model": "example/testing:free",
            "usage": {"cost": 0},
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"content": json.dumps(candidate or alternative())},
                }
            ],
        }
        if change:
            change(payload)
        self.payload = payload

    def __call__(self, req, *, timeout):
        self.calls.append((req, timeout))
        if self.cancel:
            self.cancel.set()
        return Response(json.dumps(self.payload).encode())


def run(req=None, model=None, blobs=None, tmp_path=None, cancel=None):
    return revise_plan(
        req or request(),
        cancel or Event(),
        lambda _: None,
        directory=tmp_path,
        _planner_transport=model or ModelTransport(),
        _asset_transport=blobs or (lambda *a, **k: pytest.fail("unexpected artwork request")),
    )


def test_another_is_one_explicit_free_request_and_preserves_script_overrides_and_roles(tmp_path):
    req, model = request(feedback="وضّح الحركة"), ModelTransport()
    result = run(req, model, tmp_path=tmp_path)
    assert len(model.calls) == 1 and result.changed and result.model_requested
    sent, timeout = model.calls[0]
    assert sent.full_url == ENDPOINT and timeout == NETWORK_TIMEOUT and sent.get_method() == "POST"
    payload = json.loads(sent.data)
    assert payload["model"] == MODEL and payload["plugins"] == []
    assert payload["provider"] == {
        "allow_fallbacks": False,
        "require_parameters": True,
        "data_collection": "deny",
        "zdr": True,
        "max_price": {"prompt": 0, "completion": 0, "request": 0},
    }
    content = json.loads(payload["messages"][1]["content"])
    assert content["teacher_feedback"] == "وضّح الحركة" and content["source_lesson"] == source()
    assert "secondary_asset_catalog" not in content
    assert FAKE_KEY not in sent.data.decode() and FAKE_KEY not in repr(req) + repr(result)
    assert result.plan.to_data()["steps"][0]["rows"] == original().to_data()["steps"][0]["rows"]
    assert result.plan.to_data()["source_fingerprint"] == source()["fingerprint"]
    assert not list(tmp_path.iterdir())
    assert revision_matches(result, req.previous, req.source)
    assert "مسودة" in result.summary() and "لم يبدأ صوت" in result.summary()


@pytest.mark.parametrize(
    "options",
    [
        dict(send_consent=False),
        dict(send_consent=1),
        dict(adult=False),
        dict(adult="yes"),
        dict(key=""),
        dict(key="bad\nkey-1234"),
    ],
)
def test_alternative_without_exact_permissions_or_valid_credential_never_sends(options, tmp_path):
    model = ModelTransport()
    with pytest.raises(SceneError):
        run(request(**options), model, tmp_path=tmp_path)
    assert not model.calls and not list(tmp_path.iterdir())


@pytest.mark.parametrize("action", ["another", "external"])
def test_sacred_mode_blocks_all_choice_networks(action, tmp_path):
    old = empty_plan(source())
    old["policy"] = "sacred"
    prev = VisualPlan.from_data(old, source())
    model = ModelTransport()
    with pytest.raises(SceneError, match="النصوص المقدسة"):
        run(request(action, prev), model, tmp_path=tmp_path)
    assert not model.calls


@pytest.mark.parametrize("feedback", ["x" * 1001, "bad\x00text", "bad\ud800", None, 123])
def test_feedback_is_bounded_plain_data_not_logged_or_echoed(feedback, tmp_path):
    model = ModelTransport()
    with pytest.raises(SceneError):
        run(request(feedback=feedback), model, tmp_path=tmp_path)
    assert not model.calls


@pytest.mark.parametrize("action", ["search-web", "https://evil.invalid", "approve", None])
def test_unknown_actions_do_not_become_urls_or_approval(action):
    model = ModelTransport()
    with pytest.raises(SceneError):
        run(request(action), model)
    assert not model.calls


def test_oversized_previous_plan_is_rejected_before_model(monkeypatch):
    monkeypatch.setattr(revision, "MAX_PREVIOUS_BYTES", 5)
    model = ModelTransport()
    with pytest.raises(SceneError, match="كبيرة"):
        run(model=model)
    assert not model.calls


def test_cloud_step_and_character_caps_still_apply_before_any_network():
    manifest = parse_lesson(
        "# Many\n" + "\n".join(f"## S{i}\nA cue." for i in range(13))
    ).manifest()
    prev = VisualPlan.from_data(empty_plan(manifest), manifest)
    model = ModelTransport()
    with pytest.raises(SceneError, match="12 خطوة"):
        run(request(previous=prev, manifest=manifest), model)
    assert not model.calls


@pytest.mark.parametrize(
    "mutation",
    [
        lambda d: d["steps"][0]["rows"][0].update(speech="Changed narration."),
        lambda d: d["steps"][0]["rows"][0].update(display="Changed display."),
        lambda d: d["steps"][0].update(rows=[]),
        lambda d: d.update(subject="Another subject"),
        lambda d: d.update(grade="Another grade"),
        lambda d: d.update(source_fingerprint="0" * 64),
    ],
)
def test_model_cannot_change_reviewed_content_or_source_when_changing_drawing(mutation):
    candidate = alternative()
    mutation(candidate)
    model = ModelTransport(candidate)
    before = original().payload_json
    with pytest.raises(SceneError):
        run(model=model)
    assert len(model.calls) == 1 and original().payload_json == before


def test_model_cannot_smuggle_prepared_paths_credit_or_resources():
    candidate = alternative(asset_id="gi-water-drop")
    candidate["resources"] = [normalize_svg(raw("gi-water-drop"), "gi-water-drop")]
    with pytest.raises(SceneError):
        run(request("external"), ModelTransport(candidate))


def test_another_never_accepts_secondary_asset_as_a_hidden_download():
    with pytest.raises(SceneError):
        run(model=ModelTransport(alternative(asset_id="gi-water-drop")))


def test_external_from_original_plan_proposes_and_prepares_without_teacher_file_selection(tmp_path):
    req = request("external")
    model, blobs = ModelTransport(alternative(asset_id="gi-water-drop")), BlobTransport()
    result = run(req, model, blobs, tmp_path)
    assert result.changed and result.model_requested and len(model.calls) == len(blobs.calls) == 1
    r = result.plan.to_data()["resources"][0]
    assert r["id"] == "gi-water-drop" and r["credit"]["license"] == "CC-BY-3.0"
    assert r["credit"]["attribution"] == "Icons made by Sbed"
    assert result.outcomes and "نُزّل" in result.outcomes[0][1]
    body = json.loads(model.calls[0][0].data)
    data = json.loads(body["messages"][1]["content"])
    assert len(data["secondary_asset_catalog"]) == 16
    for req_blob, _ in blobs.calls:
        assert req_blob.get_method() == "GET" and req_blob.data is None
        assert req_blob.get_header("Authorization") is None
        assert req_blob.full_url.startswith(
            "https://api.github.com/repos/game-icons/icons/git/blobs/"
        )
    assert revision_matches(result, req.previous, req.source)


def test_pending_asset_ids_are_prepared_automatically_without_a_language_model_or_key(tmp_path):
    prev = VisualPlan.from_data(alternative(asset_id="gi-water-drop"), source())
    req = request("external", prev, key="", send_consent=False, adult=False)
    model, blobs = ModelTransport(), BlobTransport()
    result = run(req, model, blobs, tmp_path)
    assert not result.model_requested and not model.calls and len(blobs.calls) == 1
    assert result.changed and result.plan.to_data()["resources"][0]["id"] == "gi-water-drop"
    # The same choice on the same unprepared plan uses the now-verified cache, no new GET.
    again = run(req, model, BlobTransport(override=b"bad"), tmp_path)
    assert again.plan == result.plan and "الذاكرة" in again.outcomes[0][1]


def test_feedback_on_a_pending_asset_requests_a_new_plan_instead_of_ignoring_the_feedback(tmp_path):
    prev = VisualPlan.from_data(alternative(asset_id="gi-water-drop"), source())
    req = request("external", prev, feedback="اجعل الرمز أصغر")
    assert needs_planner(prev, "external", feedback=req.feedback)
    candidate = alternative(prev, asset_id="gi-water-drop")
    candidate["steps"][0]["elements"][0]["w"] = 80
    model, blobs = ModelTransport(candidate), BlobTransport()
    result = run(req, model, blobs, tmp_path)
    assert result.model_requested and result.changed and len(model.calls) == len(blobs.calls) == 1


@pytest.mark.parametrize("permission", [False, 1, "yes", None])
def test_external_needs_download_permission_before_model_or_download(permission, tmp_path):
    model, blobs = ModelTransport(), BlobTransport()
    with pytest.raises(SceneError, match="إذن مستقل"):
        run(request("external", download_consent=permission), model, blobs, tmp_path)
    assert not model.calls and not blobs.calls


def test_fully_prepared_external_plan_filters_used_ids_and_sends_no_paths_or_credits(tmp_path):
    prev = VisualPlan.from_data(alternative(asset_id="gi-water-drop"), source()).to_data()
    art = normalize_svg(raw("gi-water-drop"), "gi-water-drop")
    prev["resources"] = [art]
    prev = VisualPlan.from_data(prev, source())
    req = request("external", prev)
    _, text = revision_prompt(req)
    data = json.loads(text)
    assert "resources" not in data["previous_visual_plan"]
    assert "gi-water-drop" not in {e["id"] for e in data["secondary_asset_catalog"]}
    assert art["paths"][0] not in text and art["credit"]["source"] not in text
    model, blobs = (
        ModelTransport(alternative(prev, asset_id="gi-magnifying-glass")),
        BlobTransport(),
    )
    result = run(req, model, blobs, tmp_path)
    assert result.changed and result.plan.to_data()["resources"][0]["id"] == "gi-magnifying-glass"
    assert "origin" not in data["previous_visual_plan"]


def test_model_cannot_select_an_excluded_already_prepared_resource_as_new(tmp_path):
    prev = alternative(asset_id="gi-water-drop")
    prev["resources"] = [normalize_svg(raw("gi-water-drop"), "gi-water-drop")]
    prev = VisualPlan.from_data(prev, source())
    blobs = BlobTransport()
    with pytest.raises(SceneError, match="مختلفًا"):
        run(
            request("external", prev),
            ModelTransport(alternative(prev, asset_id="gi-water-drop")),
            blobs,
            tmp_path,
        )
    assert not blobs.calls


def test_no_suitable_external_asset_has_an_honest_local_result_and_no_download(tmp_path):
    model, blobs = ModelTransport(), BlobTransport()
    result = run(request("external"), model, blobs, tmp_path)
    assert result.changed and not result.outcomes and not blobs.calls
    assert "لم يُقترح مورد خارجي مناسب" in result.summary()
    assert "لم يُنزّل ملف" in result.summary()


def test_identical_or_notes_only_model_reply_is_not_reported_as_a_new_visual():
    candidate = original().to_data()
    candidate["notes"] = ["New commentary is not a new visual."]
    result = run(model=ModelTransport(candidate))
    assert not result.changed and result.plan == original()
    assert "لم ينتج تغيير مرئي" in result.summary()
    assert revision_matches(result, original(), source())


def test_external_failure_keeps_original_fallback_and_does_not_retry(tmp_path):
    prev = VisualPlan.from_data(alternative(asset_id="gi-water-drop"), source())
    blobs = BlobTransport(override=b"corrupt")
    result = run(request("external", prev), ModelTransport(), blobs, tmp_path)
    assert len(blobs.calls) == 1 and not result.changed and result.plan == prev
    assert "البديل المحلي" in result.summary() and not list(tmp_path.iterdir())


@pytest.mark.parametrize(
    "change",
    [
        lambda d: d.update(model="paid/model"),
        lambda d: d.update(usage={"cost": 1}),
        lambda d: d.update(usage={}),
        lambda d: d["choices"][0].update(finish_reason="length"),
        lambda d: d["choices"][0]["message"].update(content="not JSON"),
        lambda d: d["choices"][0]["message"].update(content=FAKE_KEY),
    ],
)
def test_free_privacy_response_guards_also_protect_the_review_pipeline(change, tmp_path):
    model, blobs = ModelTransport(change=change), BlobTransport()
    with pytest.raises(SceneError):
        run(request("external"), model, blobs, tmp_path)
    assert len(model.calls) == 1 and not blobs.calls


@pytest.mark.parametrize("code", [401, 402, 403, 429, 500])
def test_review_refusal_is_not_a_paid_fallback_or_automatic_repair(code):
    calls = []

    def fail(req, **kwargs):
        calls.append(req)
        raise HTTPError(ENDPOINT, code, "private upstream detail", {}, io.BytesIO())

    with pytest.raises(SceneError) as err:
        run(model=fail)
    assert len(calls) == 1 and "private upstream detail" not in str(err.value)


def test_credential_inside_feedback_or_previous_plan_never_gets_sent():
    model = ModelTransport()
    with pytest.raises(SceneError):
        run(request(feedback=FAKE_KEY), model)
    data = original().to_data()
    data["notes"] = [FAKE_KEY]
    with pytest.raises(SceneError):
        run(request(previous=VisualPlan.from_data(data, source())), model)
    assert not model.calls


def test_cancel_before_or_after_model_does_not_download_or_return_partial_plan(tmp_path):
    event, model, blobs = Event(), ModelTransport(), BlobTransport()
    event.set()
    with pytest.raises(Cancelled):
        run(request("external"), model, blobs, tmp_path, event)
    assert not model.calls and not blobs.calls
    event = Event()
    model = ModelTransport(alternative(asset_id="gi-water-drop"), cancel=event)
    with pytest.raises(Cancelled):
        run(request("external"), model, blobs, tmp_path, event)
    assert len(model.calls) == 1 and not blobs.calls


def test_expanded_origin_and_every_reviewed_row_are_retained_on_revision():
    draft = LessonDraft.load(ROOT / "examples/complete-lesson-demo.json")
    lesson = draft.compile()
    manifest = replace(lesson, visuals=None).manifest()
    prev = lesson.visuals
    candidate = alternative(prev)
    result = run(request(previous=prev, manifest=manifest), ModelTransport(candidate))
    assert result.changed and result.plan.to_data()["origin"] == prev.to_data()["origin"]
    assert result.plan.to_data()["schema"] == 2
    assert draft.bind_plan(result.plan, replace(lesson, visuals=None)) == result.plan
    assert revision_matches(result, prev, manifest)
    assert (
        json.loads(revision_prompt(request(previous=prev, manifest=manifest))[1])[
            "previous_visual_plan"
        ]["schema"]
        == 1
    )


def test_expanded_revision_cannot_remove_an_explanation_drawing():
    draft = LessonDraft.load(ROOT / "examples/complete-lesson-demo.json")
    lesson = draft.compile()
    manifest = replace(lesson, visuals=None).manifest()
    candidate = alternative(lesson.visuals)
    candidate["steps"][1]["elements"] = []
    with pytest.raises(SceneError, match="مراحل الدرس"):
        run(request(previous=lesson.visuals, manifest=manifest), ModelTransport(candidate))


def test_matching_checks_reject_changed_base_source_action_and_false_changed_claim():
    req = request()
    result = run(req)
    assert revision_matches(result, req.previous, req.source)
    other = VisualPlan.from_data(alternative(), source())
    assert not revision_matches(result, other, source())
    assert not revision_matches(replace(result, source_fingerprint="0" * 64), original(), source())
    assert not revision_matches(replace(result, action="approve"), original(), source())
    assert not revision_matches(replace(result, changed=False), original(), source())


def test_final_revision_round_trips_offline_with_credits_without_approval_or_credential(tmp_path):
    result = run(
        request("external"),
        ModelTransport(alternative(asset_id="gi-water-drop")),
        BlobTransport(),
        tmp_path / "cache",
    )
    lesson = parse_lesson(source()["script"])
    save_whiteboard(replace(lesson, visuals=result.plan), tmp_path / "result.html")
    reloaded = WhiteboardPage.load(tmp_path / "result.html")
    assert reloaded.lesson.visuals == result.plan
    text = (tmp_path / "result.html").read_text("utf-8-sig")
    assert "Icons made by Sbed" in text and FAKE_KEY not in text
    assert '<script id="nova-whiteboard-recordings"' not in text


def test_optional_session_credential_is_source_scoped_redacted_and_absolutely_time_bounded():
    key = ReviewCredential()
    assert key.get("source", now=10) == ""
    key.remember(FAKE_KEY, "source", now=100)
    assert key.get("source", now=100) == FAKE_KEY
    assert key.get("source", now=100 + revision.SESSION_SECONDS - 1) == FAKE_KEY
    assert FAKE_KEY not in repr(key)
    assert key.get("source", now=100 + revision.SESSION_SECONDS) == ""
    key.remember(FAKE_KEY, "source", now=100)
    assert key.get("changed-source", now=101) == ""
    assert key.get("source", now=102) == ""
    key.remember(FAKE_KEY, "source", now=100)
    key.clear()
    assert key.get("source", now=101) == ""


def test_cancel_during_automatic_resource_preparation_never_returns_a_partial_plan(tmp_path):
    previous = VisualPlan.from_data(alternative(asset_id="gi-water-drop"), source())
    event, calls = Event(), []

    def cancelled_blob(req, **kwargs):
        calls.append(req)
        event.set()
        return BlobTransport()(req, **kwargs)

    with pytest.raises(Cancelled):
        run(request("external", previous), ModelTransport(), cancelled_blob, tmp_path, event)
    assert len(calls) == 1 and "resources" not in previous.to_data()
    assert not list(tmp_path.iterdir())


def test_matching_does_not_accept_a_forged_result_that_drops_expanded_origin():
    draft = LessonDraft.load(ROOT / "examples/complete-lesson-demo.json")
    lesson = draft.compile()
    manifest = replace(lesson, visuals=None).manifest()
    result = run(
        request(previous=lesson.visuals, manifest=manifest),
        ModelTransport(alternative(lesson.visuals)),
    )
    detached = result.plan.to_data()
    detached.pop("origin")
    detached["schema"] = 1
    forged = replace(result, plan=VisualPlan.from_data(detached, manifest))
    with pytest.raises(SceneError, match="ارتباط"):
        revision_matches(forged, lesson.visuals, manifest)


def test_arbitrary_model_connection_exceptions_are_redacted_not_logged_with_key():
    def fail(req, **kwargs):
        raise RuntimeError("upstream echoed " + FAKE_KEY)

    with pytest.raises(SceneError) as err:
        run(model=fail)
    assert FAKE_KEY not in str(err.value)
