"""Pinned-resource contracts. Mock transports are NOT live semantic inference."""

import base64
import copy
import hashlib
import io
import json
from dataclasses import replace
from pathlib import Path
from threading import Event
from urllib.error import HTTPError, URLError

import pytest

from nova_voice import lesson_planner, scene_planner
from nova_voice import secondary_assets as assets
from nova_voice.lesson_draft import LessonDraft
from nova_voice.scene_graph import validate_elements, walk_elements
from nova_voice.scenes import SceneError, VisualPlan, empty_plan, review_text
from nova_voice.timing import data_fingerprint
from nova_voice.voices import Cancelled
from nova_voice.whiteboard import WhiteboardPage, parse_lesson, save_whiteboard, whiteboard_html

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((ROOT / "tests/fixtures/secondary-cases.json").read_text())
ENTRIES = assets.catalog()["entries"]


def source():
    return parse_lesson("# Source\nFirst cue.\nSecond cue.\nLast cue.")


def element():
    return copy.deepcopy(CASES["valid"][0]["elements"][0])


def plan(elements=None):
    data = empty_plan(source().manifest())
    data["steps"][0]["elements"] = elements or [element()]
    return VisualPlan.from_data(data, source().manifest())


def raw(identifier):
    e = assets.asset_info(identifier)
    return (ROOT / "tests/fixtures/secondary-raw" / e["upstream_path"]).read_bytes()


def resource(identifier="gi-magnifying-glass"):
    return assets.normalize_svg(raw(identifier), identifier)


@pytest.mark.parametrize("case", CASES["valid"], ids=lambda c: c["id"])
def test_shared_valid_assets_round_trip_source_and_bounded_fallbacks(tmp_path, case):
    p = plan(case["elements"])
    assert validate_elements(case["elements"], 3) <= 60
    assert len(list(walk_elements(case["elements"]))) == validate_elements(case["elements"], 3)
    illustrated = replace(source(), visuals=p)
    assert illustrated.script == source().script
    assert illustrated.spoken_script == source().spoken_script
    assert illustrated.speakers == source().speakers
    assert VisualPlan.from_json(p.to_json(), source().manifest()) == p
    assert "جزء من البديل المحلي الأصلي" in review_text(p, source().manifest())
    save_whiteboard(illustrated, tmp_path / "asset.html")
    assert WhiteboardPage.load(tmp_path / "asset.html").lesson == illustrated


@pytest.mark.parametrize("case", CASES["invalid"], ids=lambda c: c["id"])
def test_shared_invalid_assets_reject_before_render_or_network(case):
    with pytest.raises(SceneError):
        validate_elements(case["elements"], 3)
    with pytest.raises(SceneError):
        plan(case["elements"])


@pytest.mark.parametrize("entry", ENTRIES, ids=lambda e: e["id"])
def test_every_pinned_raw_fixture_is_audited_with_complete_attribution(entry):
    r = resource(entry["id"])
    assert hashlib.sha256(raw(entry["id"])).hexdigest() == entry["raw_sha256"]
    assert len(raw(entry["id"])) == entry["raw_bytes"]
    assert (
        data_fingerprint({"view_box": [0, 0, 512, 512], "paths": r["paths"]})
        == entry["drawing_fingerprint"]
    )
    assert r["credit"]["source"].endswith(assets.CATALOG_PIN + "/" + entry["upstream_path"])
    assert r["credit"]["attribution"] == "Icons made by " + r["credit"]["author"]
    assert r["credit"]["license"] == "CC-BY-3.0" and r["credit"]["changes"]
    assets.validate_resource(r)


def test_catalogue_is_copied_and_not_a_model_engine_or_geometry_bundle():
    c = assets.catalog()
    assert len(c["entries"]) == 16
    c["entries"][0]["credit"]["author"] = "BAD"
    assert assets.catalog()["entries"][0]["credit"]["author"] != "BAD"
    for e in assets.prompt_catalog():
        assert set(e) == {"id", "meaning"} and e["meaning"]
        assert "https:" not in json.dumps(e)
    with pytest.raises(SceneError):
        assets.asset_info("https://untrusted.invalid/file.svg")


@pytest.mark.parametrize(
    "mutation",
    [
        lambda r: r["paths"].append("M0 0L5 5"),
        lambda r: r.update(paths=["M0 0L5 5"]),
        lambda r: r.update(paths=["<script>alert(1)</script>"]),
        lambda r: r.update(paths=["M0 0L1e999 2"]),
        lambda r: r.update(paths=[]),
        lambda r: r.update(paths=None),
        lambda r: r["credit"].update(author="Other"),
        lambda r: r["credit"].pop("changes"),
        lambda r: r["credit"].update(source="https://untrusted.invalid"),
        lambda r: r.update(url="https://untrusted.invalid/a.svg"),
        lambda r: r.update(id="gi-open-book"),
    ],
)
def test_embedded_resource_tampering_is_rejected_even_with_recomputed_lesson_hash(mutation):
    r = resource()
    mutation(r)
    data = plan().to_data()
    data["resources"] = [r]
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, source().manifest())


def test_resources_must_be_sorted_unique_and_referenced_and_preserve_all_credits(tmp_path):
    demo = WhiteboardPage.load(ROOT / "examples/secondary-source-demo.html")
    assert len(assets.credits(demo.lesson.visuals)) == 2
    data = demo.lesson.visuals.to_data()
    origin = replace(demo.lesson, visuals=None).manifest()
    for value in (
        None,
        {},
        data["resources"] * 2,
        list(reversed(data["resources"])),
        [resource("gi-fox")],
    ):
        invalid = copy.deepcopy(data)
        invalid["resources"] = value
        with pytest.raises(SceneError):
            VisualPlan.from_data(invalid, origin)
    dest = tmp_path / "bundle.html"
    save_whiteboard(demo.lesson, dest)
    html = dest.read_text("utf-8-sig")
    assert "wb-secondary-credits" in html
    for credit in assets.credits(demo.lesson.visuals):
        for value in credit.values():
            assert value in html
        assert credit["attribution"] in review_text(demo.lesson.visuals, origin)
    assert WhiteboardPage.load(dest).lesson == demo.lesson


def test_plan_aggregate_id_reference_depth_and_node_limits_include_fallback_parts():
    six = [dict(element(), asset_id=e["id"]) for e in ENTRIES[:6]]
    assert plan(six)
    with pytest.raises(SceneError):
        plan(six + [dict(element(), asset_id=ENTRIES[6]["id"])])
    assert plan([element()] * 24)
    with pytest.raises(SceneError):
        plan([element()] * 25)
    # Max60 nodes in10 source steps; every original fallback counts, not just24 wrappers.
    s = parse_lesson("# Many\n" + "\n".join(f"## S{i}\nOne cue." for i in range(11)))
    data = empty_plan(s.manifest())
    original = dict(kind="rect", row=0, x=0, y=0, w=10, h=10)
    group = dict(kind="group", name="parts", row=0, x=0, y=0, children=[original] * 18)
    for step in data["steps"]:
        step["elements"] = [copy.deepcopy(group)] * 3  # 57 nodes
    data["steps"][0]["elements"][-1]["children"][-1] = element()  # 58 with fallback
    with pytest.raises(SceneError):
        VisualPlan.from_data(data, s.manifest())


@pytest.mark.parametrize(
    "bad",
    [
        b'<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>',
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><script/></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" onload="x"/>',
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image href="https://x"/></svg>',
        raw("gi-magnifying-glass").replace(b'fill="#fff"', b'fill="url(https://x)"'),
        raw("gi-magnifying-glass").replace(b"<path fill=", b'<path style="fill:red" fill='),
        raw("gi-magnifying-glass").replace(b"M0 0h512v512H0z", b"M0 0h511v512H0z"),
    ],
)
def test_xml_subset_rejects_active_or_unexpected_content_even_after_raw_hash_check(
    monkeypatch, bad
):
    entry = assets.asset_info("gi-magnifying-glass")
    entry.update(raw_bytes=len(bad), raw_sha256=hashlib.sha256(bad).hexdigest())
    monkeypatch.setattr(assets, "asset_info", lambda _: entry)
    with pytest.raises(SceneError):
        assets.normalize_svg(bad, entry["id"])


class BlobResponse(io.BytesIO):
    def __init__(self, payload, endpoint, *, status=200, headers=None):
        super().__init__(payload)
        self.endpoint = endpoint
        self.status = status
        self.headers = headers or {
            "Content-Type": "application/json",
            "Content-Encoding": "identity",
        }

    def geturl(self):
        return self.endpoint


class BlobTransport:
    def __init__(self, *, override=None, response_options=None):
        self.calls = []
        self.override = override
        self.options = response_options or {}
        self.responses = []

    def __call__(self, request, *, timeout):
        self.calls.append((request, timeout))
        entry = next(e for e in ENTRIES if request.full_url.endswith(e["blob_sha1"]))
        value = {
            "sha": entry["blob_sha1"],
            "size": entry["raw_bytes"],
            "encoding": "base64",
            "content": base64.b64encode(raw(entry["id"])).decode(),
        }
        data = self.override(value) if self.override else json.dumps(value).encode()
        options = {"endpoint": request.full_url} | self.options
        response = BlobResponse(data, **options)
        self.responses.append(response)
        return response


def test_download_requires_exact_consent_and_fixed_public_get_without_lesson_key_or_redirects():
    t = BlobTransport()
    for consent in (False, 1, "yes", None):
        with pytest.raises(SceneError):
            assets.download_resource("gi-magnifying-glass", Event(), consent=consent, _transport=t)
    assert not t.calls
    r = assets.download_resource("gi-magnifying-glass", Event(), consent=True, _transport=t)
    assert r == resource()
    req, timeout = t.calls[0]
    assert len(t.calls) == 1 and req.get_method() == "GET" and req.data is None
    assert (
        req.full_url
        == "https://api.github.com/repos/game-icons/icons/git/blobs/"
        + assets.asset_info(r["id"])["blob_sha1"]
    )
    assert timeout == 20 and "Authorization" not in req.headers and "Cookie" not in req.headers
    assert t.responses[0].closed
    for url in ("https://api.github.com/x", "https://evil.invalid", "file:///etc/passwd"):
        assert assets._NoRedirect().redirect_request(req, None, 302, "redirect", {}, url) is None


@pytest.mark.parametrize(
    "kwargs",
    [
        {"response_options": {"status": 302}},
        {"response_options": {"endpoint": "https://evil.invalid/redirect"}},
        {"response_options": {"headers": {"Content-Encoding": "gzip"}}},
        {"response_options": {"headers": {"Content-Type": "text/html"}}},
        {"override": lambda _: b"x" * (assets.MAX_RESPONSE_BYTES + 1)},
        {"override": lambda _: b'{"sha":"x","sha":"x"}'},
        {"override": lambda v: json.dumps(dict(v, encoding="other")).encode()},
        {"override": lambda v: json.dumps(dict(v, size=True)).encode()},
        {"override": lambda v: json.dumps(dict(v, sha="0" * 40)).encode()},
        {"override": lambda v: json.dumps(dict(v, content="%%%invalid%%%")).encode()},
        {
            "override": lambda v: json.dumps(
                dict(v, content=base64.b64encode(b"<svg/>").decode())
            ).encode()
        },
    ],
)
def test_untrusted_responses_are_bounded_closed_and_never_retried(kwargs):
    t = BlobTransport(**kwargs)
    with pytest.raises(SceneError):
        assets.download_resource("gi-magnifying-glass", Event(), consent=True, _transport=t)
    assert len(t.calls) == 1 and t.responses[0].closed


@pytest.mark.parametrize(
    "error",
    [
        URLError("secret-sentinel"),
        TimeoutError("secret-sentinel"),
        HTTPError("https://x", 429, "secret-sentinel", {}, None),
    ],
)
def test_transport_errors_are_sanitized_and_fall_back_without_extra_requests(
    tmp_path, caplog, error
):
    calls = []

    def failed(req, **kwargs):
        calls.append(req)
        raise error

    result = assets.prepare_plan(
        plan(),
        source().manifest(),
        Event(),
        lambda _: None,
        allow_download=True,
        directory=tmp_path,
        _transport=failed,
    )
    assert len(calls) == 1 and "resources" not in result.plan.to_data()
    assert "البديل المحلي" in result.summary()
    assert "secret-sentinel" not in result.summary() and not caplog.records
    assert not list(tmp_path.iterdir())


def test_cache_is_opt_in_verified_atomic_and_reused_without_network(tmp_path):
    t = BlobTransport()
    original = plan()
    local = assets.prepare_plan(
        original, source().manifest(), Event(), lambda _: None, directory=tmp_path, _transport=t
    )
    assert not t.calls and local.plan == original
    prepared = assets.prepare_plan(
        original,
        source().manifest(),
        Event(),
        lambda _: None,
        allow_download=True,
        directory=tmp_path,
        _transport=t,
    )
    assert len(t.calls) == 1 and prepared.plan.to_data()["resources"] == [resource()]
    assert assets.preparation_matches(prepared, original, source().manifest())
    assert not assets.preparation_matches(
        prepared, plan([dict(element(), x=60)]), source().manifest()
    )
    assert len(list(tmp_path.iterdir())) == 1 and not list(tmp_path.glob(".nova-*"))
    again = assets.prepare_plan(
        original, source().manifest(), Event(), lambda _: None, directory=tmp_path, _transport=t
    )
    assert len(t.calls) == 1 and again.plan == prepared.plan
    assert "الذاكرة المحلية" in again.summary()
    embedded = assets.prepare_plan(
        prepared.plan,
        source().manifest(),
        Event(),
        lambda _: None,
        directory=tmp_path / "missing",
        _transport=t,
    )
    assert embedded.plan == prepared.plan and len(t.calls) == 1
    assert assets.use_local_fallbacks(prepared.plan, source().manifest()) == original


def test_bad_cache_and_symlinks_never_reach_renderer_and_clear_only_vetted_files(tmp_path):
    e = assets.asset_info("gi-magnifying-glass")
    entry = tmp_path / (e["raw_sha256"] + ".json")
    keep = tmp_path / "settings.json"
    keep.write_text("keep")
    entry.write_text('{"paths":["<script/>"]}')
    t = BlobTransport()
    result = assets.prepare_plan(
        plan(), source().manifest(), Event(), lambda _: None, directory=tmp_path, _transport=t
    )
    assert result.plan == plan() and not t.calls
    entry.unlink()
    entry.symlink_to(keep)
    result = assets.prepare_plan(
        plan(), source().manifest(), Event(), lambda _: None, directory=tmp_path, _transport=t
    )
    assert result.plan == plan() and not t.calls
    assert assets.clear_cache(tmp_path) == 1 and keep.read_text() == "keep"
    assert assets.clear_cache(tmp_path) == 0


def test_cancellation_before_network_during_read_and_before_cache_publication(
    tmp_path, monkeypatch
):
    cancel = Event()
    cancel.set()
    t = BlobTransport()
    with pytest.raises(Cancelled):
        assets.prepare_plan(
            plan(),
            source().manifest(),
            cancel,
            lambda _: None,
            allow_download=True,
            directory=tmp_path,
            _transport=t,
        )
    assert not t.calls
    cancel.clear()
    original_call = t.__call__

    def transport(req, **kwargs):
        response = original_call(req, **kwargs)
        response.read1 = lambda _: (cancel.set(), b"x")[1]
        return response

    with pytest.raises(Cancelled):
        assets.prepare_plan(
            plan(),
            source().manifest(),
            cancel,
            lambda _: None,
            allow_download=True,
            directory=tmp_path,
            _transport=transport,
        )
    assert not list(tmp_path.iterdir()) and t.responses[0].closed
    cancel.clear()
    r = resource()
    old_fsync = assets.os.fsync

    def sync(fd):
        old_fsync(fd)
        cancel.set()

    monkeypatch.setattr(assets.os, "fsync", sync)
    with pytest.raises(Cancelled):
        assets._save_cache(r, tmp_path, cancel)
    assert not list(tmp_path.iterdir())


def test_cache_write_failure_keeps_verified_embedding_but_does_not_claim_cached(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(
        assets, "_save_cache", lambda *args: (_ for _ in ()).throw(OSError("disk full"))
    )
    result = assets.prepare_plan(
        plan(),
        source().manifest(),
        Event(),
        lambda _: None,
        allow_download=True,
        directory=tmp_path,
        _transport=BlobTransport(),
    )
    assert result.plan.to_data()["resources"] == [resource()]
    assert "تعذّر حفظ الذاكرة" in result.summary()


def test_model_catalogue_is_opt_in_in_both_prompt_paths_and_resources_are_never_model_generated():
    draft = LessonDraft.load(ROOT / "examples/complete-lesson-demo.json")
    for fn, args in (
        (scene_planner.prompt_parts, (source().manifest(),)),
        (lesson_planner.prompt_parts, (draft.brief,)),
    ):
        default_system, default_content = fn(*args)
        system, content = fn(*args, secondary_assets=True)
        assert (
            "secondary_asset_catalog" not in default_content
            and "OPTIONAL SECONDARY" not in default_system
        )
        assert (
            "OPTIONAL SECONDARY ARTWORK" in system
            and len(json.loads(content)["secondary_asset_catalog"]) == 16
        )
        assert "Static" not in default_content  # No keyword/subject routing.
        assert "drawing_fingerprint" not in content and "raw_sha256" not in content
    assets.validate_model_proposal(plan().to_data(), enabled=True)
    with pytest.raises(SceneError):
        assets.validate_model_proposal(plan().to_data(), enabled=False)
    with pytest.raises(SceneError):
        assets.validate_model_proposal(plan().to_data() | {"resources": [resource()]}, enabled=True)


def test_full_lesson_origin_survives_preparation_and_rebinding_without_rewriting_the_brief(
    tmp_path,
):
    draft = LessonDraft.load(ROOT / "examples/complete-lesson-demo.json")
    response = draft.to_data()["draft"]
    response["steps"][0]["elements"] = [element()]
    draft = LessonDraft.from_response(response, draft.brief)
    compiled = draft.compile()
    origin = compiled.visuals.to_data()["origin"]
    original = replace(compiled, visuals=None)
    prepared = assets.prepare_plan(
        compiled.visuals,
        original.manifest(),
        Event(),
        lambda _: None,
        allow_download=True,
        directory=tmp_path,
        _transport=BlobTransport(),
    )
    bound = draft.bind_plan(prepared.plan, original)
    assert bound.to_data()["origin"] == origin
    assert bound.to_data()["resources"] == [resource()]
    assert (
        prepared.plan.to_data()["source_fingerprint"]
        == compiled.visuals.to_data()["source_fingerprint"]
    )
    assert original.script == compiled.script
    with pytest.raises(SceneError):
        assets.prepare_plan(
            bound,
            parse_lesson("A different source.").manifest(),
            Event(),
            lambda _: None,
            directory=tmp_path,
        )


def test_sacred_policy_has_no_resource_preparation_and_rendering_never_reads_cache_or_network(
    monkeypatch,
):
    data = empty_plan(source().manifest())
    data["policy"] = "sacred"
    p = VisualPlan.from_data(data, source().manifest())
    with pytest.raises(SceneError):
        assets.prepare_plan(p, source().manifest(), Event(), lambda _: None)
    monkeypatch.setattr(assets, "_cached", lambda *args: pytest.fail("implicit cache access"))
    monkeypatch.setattr(
        assets, "download_resource", lambda *args, **kwargs: pytest.fail("implicit network")
    )
    assert "nova-secondary-catalog" in whiteboard_html(replace(source(), visuals=plan()))


@pytest.mark.parametrize("enabled", [False, True])
@pytest.mark.parametrize("full_lesson", [False, True])
def test_actual_free_only_request_path_carries_optional_catalog_but_never_downloads_assets(
    monkeypatch, enabled, full_lesson
):
    key = "test-only-NOT-A-REAL-KEY"
    calls = []
    monkeypatch.setattr(
        assets, "download_resource", lambda *args, **kwargs: pytest.fail("implicit download")
    )
    draft = LessonDraft.load(ROOT / "examples/complete-lesson-demo.json")
    answer = draft.to_data()["draft"] if full_lesson else plan().to_data()
    if full_lesson:
        answer["steps"][0]["elements"] = [element()]

    class Response(io.BytesIO):
        status = 200
        headers = {}

    def transport(request, **kwargs):
        calls.append(json.loads(request.data))
        return Response(
            json.dumps(
                {
                    "model": "test/example:free",
                    "usage": {"cost": 0},
                    "choices": [
                        {"finish_reason": "stop", "message": {"content": json.dumps(answer)}}
                    ],
                }
            ).encode()
        )

    fn = lesson_planner.request_lesson if full_lesson else scene_planner.request_plan
    arg = draft.brief if full_lesson else source().manifest()
    if enabled:
        result = fn(
            arg,
            key,
            Event(),
            lambda _: None,
            consent=True,
            adult=True,
            secondary_assets=True,
            _transport=transport,
        )
        data = result.compile().visuals.to_data() if full_lesson else result.to_data()
        assert "resources" not in data
        assert "gi-magnifying-glass" in assets.referenced_ids(data["steps"])
    else:
        with pytest.raises(SceneError):
            fn(arg, key, Event(), lambda _: None, consent=True, adult=True, _transport=transport)
    assert len(calls) == 1
    assert ("secondary_asset_catalog" in calls[0]["messages"][1]["content"]) == enabled
    assert calls[0]["provider"]["max_price"] == {"prompt": 0, "completion": 0, "request": 0}
    assert calls[0]["provider"]["allow_fallbacks"] is False
