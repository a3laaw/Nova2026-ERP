"""One-step immutable patches, with injected models/artwork, not live inference."""

import copy
import json
from dataclasses import replace
from threading import Event

import pytest
from test_scene_revision import FAKE_KEY, ModelTransport, request, run
from test_secondary_assets import BlobTransport, raw
from test_secondary_assets import element as original_element

from nova_voice.lesson_draft import LessonDraft
from nova_voice.scene_revision import (
    RevisionResult,
    needs_planner,
    preparation_ids,
    revision_matches,
    revision_prompt,
)
from nova_voice.scenes import SceneError, VisualPlan, empty_plan
from nova_voice.secondary_assets import normalize_svg, prepare_plan
from nova_voice.timing import data_fingerprint
from nova_voice.voices import Cancelled
from nova_voice.whiteboard import parse_lesson


def lesson():
    return parse_lesson(
        "# Scoped authored lesson\n"
        "## First\n[1] FIRST_PRIVATE_SENTINEL.\n[2] Another first cue.\n"
        "## Middle\n[2] SELECTED_PUBLIC_SENTINEL.\n[1] Another selected cue.\n"
        "## Last\n[1] LAST_PRIVATE_SENTINEL.\n[2] Another last cue.",
        dialogue=True,
    )


def previous():
    source = lesson().manifest()
    data = empty_plan(source, subject="علوم", grade="الثاني الإعدادي")
    data["notes"] = ["GLOBAL_PRIVATE_NOTE must not be sent for a targeted patch."]
    for i, step in enumerate(data["steps"]):
        step["elements"] = [dict(kind="circle", row=0, x=160 + 150 * i, y=160, r=45)]
        step["rows"] = [
            dict(index=1, display=f"Reviewed display {i}", speech=f"Reviewed speech {i}.")
        ]
    return VisualPlan.from_data(data, source)


def scoped_request(action="another", *, plan=None, manifest=None, **kwargs):
    return request(
        action, plan or previous(), manifest or lesson().manifest(), target_step=1, **kwargs
    )


def patch(req=None, *, elements=None):
    req = req or scoped_request()
    return dict(
        schema=1,
        source_fingerprint=req.source["fingerprint"],
        target_step=req.target_step,
        description="Revised target drawing only, not new narration.",
        elements=elements
        if elements is not None
        else [dict(kind="rect", row=1, x=250, y=160, w=100, h=70)],
    )


def element(identifier):
    return original_element() | {"asset_id": identifier}


def assets_in(plan=None, *, target=None, outside=None, prepared=()):
    data = (plan or previous()).to_data()
    for index, identifier in ((1, target), (0, outside)):
        if identifier:
            data["steps"][index]["elements"] = [element(identifier)]
    if prepared:
        data["resources"] = [normalize_svg(raw(i), i) for i in sorted(prepared)]
    return VisualPlan.from_data(data, lesson().manifest())


@pytest.mark.parametrize("target", [0, 1, 2])
def test_scoped_patch_changes_only_the_selected_scene_and_never_source_speech_roles_or_notes(
    target,
):
    req = replace(scoped_request(feedback="وضّح الرسم فقط"), target_step=target)
    old_source, old_plan = copy.deepcopy(req.source), req.previous.payload_json
    model = ModelTransport(patch(req))
    result = run(req, model)
    data, old = result.plan.to_data(), req.previous.to_data()
    assert result.target_step == target and result.changed and result.model_requested
    assert len(model.calls) == 1 and revision_matches(result, req.previous, req.source)
    assert data["steps"][target]["description"] == patch(req)["description"]
    for i, (a, b) in enumerate(zip(data["steps"], old["steps"], strict=True)):
        assert a["rows"] == b["rows"] and a["index"] == b["index"]
        if i != target:
            assert a == b
    assert {k: v for k, v in data.items() if k != "steps"} == {
        k: v for k, v in old.items() if k != "steps"
    }
    assert req.source == old_source and req.previous.payload_json == old_plan
    assert FAKE_KEY not in repr(req) + repr(result) + result.summary()
    assert f"المشهد {target + 1}" in result.summary()


def test_scoped_payload_sends_only_target_rows_overrides_and_metadata_not_other_script_or_origins():
    req = scoped_request(feedback="هذه ملاحظة لهذا المشهد.")
    system, content = revision_prompt(req)
    data = json.loads(content)
    assert "TARGETED RESPONSE OVERRIDES" in system
    assert "source_lesson" not in data and "script" not in data
    assert data["source_scene"] == req.source["steps"][1]
    assert data["lesson_title"] == req.source["title"] and data["dialogue"] is True
    assert data["output_skeleton"]["target_step"] == 1
    assert data["teacher_feedback"] == req.feedback
    assert data["previous_visual_plan"]["steps"] == [req.previous.to_data()["steps"][1]]
    assert data["previous_visual_plan"]["notes"] == []
    for sentinel in (
        "FIRST_PRIVATE_SENTINEL",
        "LAST_PRIVATE_SENTINEL",
        "GLOBAL_PRIVATE_NOTE",
        FAKE_KEY,
    ):
        assert sentinel not in content
    assert "SELECTED_PUBLIC_SENTINEL" in content
    assert "origin" not in data["previous_visual_plan"]
    assert "resources" not in data["previous_visual_plan"]


@pytest.mark.parametrize("bad", [-1, 3, True, False, 1.0, "1", [], {}])
def test_invalid_target_rejected_before_any_request(bad, tmp_path):
    model, blobs = ModelTransport(), BlobTransport()
    with pytest.raises(SceneError, match="مشهدًا"):
        run(replace(scoped_request(), target_step=bad), model, blobs, tmp_path)
    assert not model.calls and not blobs.calls and not list(tmp_path.iterdir())


@pytest.mark.parametrize(
    "key",
    ["rows", "resources", "origin", "steps", "notes", "script", "approval", "speaker", "title"],
)
def test_scope_response_is_a_strict_patch_not_an_extra_field_or_full_plan(key):
    candidate = patch()
    candidate[key] = []
    model = ModelTransport(candidate)
    with pytest.raises(SceneError):
        run(scoped_request(), model)
    assert len(model.calls) == 1


def test_full_plan_even_with_only_target_edits_is_not_accepted_as_a_scoped_patch():
    full = previous().to_data()
    full["steps"][1]["elements"] = patch()["elements"]
    with pytest.raises(SceneError):
        run(scoped_request(), ModelTransport(full))


@pytest.mark.parametrize(
    "mutation",
    [
        lambda p: p.update(schema=True),
        lambda p: p.update(schema=2),
        lambda p: p.update(target_step=True),
        lambda p: p.update(target_step=0),
        lambda p: p.update(target_step=None),
        lambda p: p.update(source_fingerprint="0" * 64),
        lambda p: p.update(description=""),
        lambda p: p.update(elements=None),
        lambda p: p.update(elements={}),
        lambda p: p.update(elements=[None]),
        lambda p: p["elements"][0].update(row=2),
        lambda p: p["elements"][0].update(approval=True),
        lambda p: p["elements"][0].update(x=300.0),
        lambda p: p["elements"][0].update(x=float("nan")),
        lambda p: p["elements"][0].update(w=float("inf")),
    ],
)
def test_malformed_target_or_elements_do_not_reach_rendering_or_auto_repair(mutation):
    candidate = patch()
    mutation(candidate)
    model = ModelTransport(candidate)
    with pytest.raises(SceneError):
        run(scoped_request(), model)
    assert len(model.calls) == 1


@pytest.mark.parametrize(
    "answer", ["[]", "null", "{}", "not json", '{"schema":1,"schema":1}', "\ud800", "[" * 1100]
)
def test_invalid_raw_patch_is_handled_without_echoing_or_retry(answer):
    model = ModelTransport()
    model.payload["choices"][0]["message"]["content"] = answer
    with pytest.raises(SceneError):
        run(scoped_request(), model)
    assert len(model.calls) == 1


def test_fenced_strict_patch_has_same_validation_as_unfenced_json():
    model = ModelTransport()
    model.payload["choices"][0]["message"]["content"] = "```json\n" + json.dumps(patch()) + "\n```"
    assert run(scoped_request(), model).changed


def test_selected_scene_can_be_revised_without_sending_a_longer_whole_lesson():
    source = parse_lesson(
        "# Long source\n" + "\n".join(f"## Step{i}\nPrivate cue {i}." for i in range(14))
    ).manifest()
    prev = VisualPlan.from_data(empty_plan(source), source)
    req = scoped_request(plan=prev, manifest=source)
    _, sent = revision_prompt(req)
    assert "Private cue 1." in sent and "Private cue 13." not in sent
    result = run(
        req, ModelTransport(patch(req, elements=[dict(kind="circle", row=0, x=90, y=90, r=20)]))
    )
    assert result.changed and len(result.plan.to_data()["steps"]) == 14


def test_target_scene_character_limit_and_previous_scene_byte_limit_are_checked_before_network(
    monkeypatch,
):
    from nova_voice import scene_revision as revision

    monkeypatch.setattr(revision.planner, "MAX_CLOUD_CHARACTERS", 5)
    model = ModelTransport(patch())
    with pytest.raises(SceneError, match="نص المشهد"):
        run(scoped_request(), model)
    assert not model.calls
    monkeypatch.setattr(revision.planner, "MAX_CLOUD_CHARACTERS", 12000)
    monkeypatch.setattr(revision, "MAX_PREVIOUS_BYTES", 5)
    with pytest.raises(SceneError, match="كبيرة"):
        run(scoped_request(), model)
    assert not model.calls


def test_unselected_large_notes_do_not_consume_selected_previous_scene_budget(monkeypatch):
    from nova_voice import scene_revision as revision

    data = previous().to_data()
    data["notes"] = ["private note " * 25 for _ in range(12)]
    plan = VisualPlan.from_data(data, lesson().manifest())
    _, text = revision_prompt(scoped_request(plan=plan))
    size = len(
        json.dumps(
            json.loads(text)["previous_visual_plan"],
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
    )
    monkeypatch.setattr(revision, "MAX_PREVIOUS_BYTES", size)
    assert run(scoped_request(plan=plan), ModelTransport(patch())).changed
    with pytest.raises(SceneError, match="كبيرة"):
        revision_prompt(replace(scoped_request(plan=plan), target_step=None))


def test_scoped_another_keeps_other_prepared_and_pending_resources_without_any_asset_transport(
    tmp_path,
):
    prev = assets_in(outside="gi-water-drop", prepared=("gi-water-drop",))
    req = scoped_request(plan=prev)
    blobs = BlobTransport()
    result = run(req, ModelTransport(patch(req)), blobs, tmp_path)
    assert not blobs.calls and not list(tmp_path.iterdir())
    assert result.plan.to_data()["resources"] == prev.to_data()["resources"]
    assert result.plan.to_data()["steps"][0] == prev.to_data()["steps"][0]
    assert revision_matches(result, prev, req.source)
    pending = assets_in(outside="gi-water-drop")
    assert run(scoped_request(plan=pending), ModelTransport(patch())).changed


def test_direct_external_preparation_downloads_target_exclusive_ids_only_and_keeps_outside_pending(
    tmp_path,
):
    prev = assets_in(target="gi-magnifying-glass", outside="gi-water-drop")
    req = scoped_request("external", plan=prev, key="", adult=False, send_consent=False)
    assert not needs_planner(prev, "external", target_step=1)
    assert preparation_ids(prev, 1) == ("gi-magnifying-glass",)
    model, blobs = ModelTransport(), BlobTransport()
    result = run(req, model, blobs, tmp_path)
    assert not result.model_requested and not model.calls and len(blobs.calls) == 1
    assert [r["id"] for r in result.plan.to_data()["resources"]] == ["gi-magnifying-glass"]
    assert result.plan.to_data()["steps"][0] == prev.to_data()["steps"][0]
    assert revision_matches(result, prev, req.source)


def test_direct_preparation_keeps_trusted_outside_resource_bytes_and_attribution(tmp_path):
    prev = assets_in(
        target="gi-magnifying-glass", outside="gi-water-drop", prepared=("gi-water-drop",)
    )
    req = scoped_request("external", plan=prev, key="", adult=False, send_consent=False)
    result = run(req, ModelTransport(), BlobTransport(), tmp_path)
    resources = {r["id"]: r for r in result.plan.to_data()["resources"]}
    assert resources["gi-water-drop"] == prev.to_data()["resources"][0]
    assert len(resources) == 2 and revision_matches(result, prev, req.source)


def test_shared_pending_resource_cannot_be_prepared_even_from_cache_as_a_target_only_change(
    tmp_path,
):
    prev = assets_in(target="gi-water-drop", outside="gi-water-drop")
    assert preparation_ids(prev, 1) == () and needs_planner(prev, "external", target_step=1)
    req = scoped_request("external", plan=prev)
    _, text = revision_prompt(req)
    assert "gi-water-drop" not in {e["id"] for e in json.loads(text)["secondary_asset_catalog"]}
    blobs = BlobTransport()
    with pytest.raises(SceneError, match="متاحة"):
        run(req, ModelTransport(patch(req, elements=[element("gi-water-drop")])), blobs, tmp_path)
    assert not blobs.calls
    result = run(req, ModelTransport(patch(req)), blobs, tmp_path)
    assert result.changed and not blobs.calls and not result.plan.to_data().get("resources")
    assert result.plan.to_data()["steps"][0] == prev.to_data()["steps"][0]


def test_exclusive_pending_resource_preparation_does_not_accidentally_prepare_shared_pending_ids(
    tmp_path,
):
    prev = assets_in(target="gi-water-drop", outside="gi-water-drop").to_data()
    prev["steps"][1]["elements"].append(element("gi-magnifying-glass"))
    prev = VisualPlan.from_data(prev, lesson().manifest())
    req = scoped_request("external", plan=prev, key="", adult=False, send_consent=False)
    result = run(req, ModelTransport(), BlobTransport(), tmp_path)
    assert not result.model_requested and result.changed
    assert [r["id"] for r in result.plan.to_data()["resources"]] == ["gi-magnifying-glass"]
    assert "مشترك" in result.summary() and revision_matches(result, prev, req.source)


def test_model_can_share_an_already_prepared_outside_id_without_mutating_or_downloading_it(
    tmp_path,
):
    prev = assets_in(outside="gi-water-drop", prepared=("gi-water-drop",))
    req = scoped_request("external", plan=prev)
    blobs = BlobTransport()
    result = run(
        req, ModelTransport(patch(req, elements=[element("gi-water-drop")])), blobs, tmp_path
    )
    assert result.changed and not blobs.calls
    assert result.plan.to_data()["resources"] == prev.to_data()["resources"]
    assert "مضمّن مشترك محفوظ" in result.summary() and revision_matches(result, prev, req.source)


def test_replacing_target_asset_drops_only_its_exclusive_prepared_resource(tmp_path):
    prev = assets_in(
        target="gi-water-drop",
        outside="gi-magnifying-glass",
        prepared=("gi-water-drop", "gi-magnifying-glass"),
    )
    req = scoped_request(plan=prev)
    result = run(req, ModelTransport(patch(req)), tmp_path=tmp_path)
    assert [r["id"] for r in result.plan.to_data()["resources"]] == ["gi-magnifying-glass"]
    shared = assets_in(target="gi-water-drop", outside="gi-water-drop", prepared=("gi-water-drop",))
    result = run(scoped_request(plan=shared), ModelTransport(patch()), tmp_path=tmp_path)
    assert result.plan.to_data()["resources"] == shared.to_data()["resources"]


@pytest.mark.parametrize(
    "selected",
    [
        ("gi-water-drop", "gi-water-drop"),
        ("not-allowed",),
        ["gi-water-drop"],
        (1,),
        ("gi-water-drop", "gi-magnifying-glass"),
    ],
)
def test_preparation_subset_is_checked_before_any_download(selected, tmp_path):
    prev = assets_in(target="gi-water-drop", outside="gi-magnifying-glass")
    blobs = BlobTransport()
    with pytest.raises(SceneError):
        prepare_plan(
            prev,
            lesson().manifest(),
            Event(),
            lambda _: None,
            allow_download=True,
            selected_ids=selected,
            directory=tmp_path,
            _transport=blobs,
        )
    assert not blobs.calls and not list(tmp_path.iterdir())


def test_empty_preparation_subset_does_not_touch_existing_resources_or_network(tmp_path):
    prev = assets_in(target="gi-water-drop", prepared=("gi-water-drop",))
    blobs = BlobTransport()
    result = prepare_plan(
        prev,
        lesson().manifest(),
        Event(),
        lambda _: None,
        allow_download=True,
        selected_ids=(),
        directory=tmp_path,
        _transport=blobs,
    )
    assert result.plan == prev and not result.outcomes and not blobs.calls


@pytest.mark.parametrize(
    "change", ["elements", "description", "rows", "notes", "subject", "shared-resource"]
)
def test_delivery_boundary_rechecks_outside_write_locks_on_forged_scoped_results(change):
    prev = assets_in(outside="gi-water-drop")
    data = prev.to_data()
    data["steps"][1]["elements"] = patch()["elements"]
    if change == "shared-resource":
        data["resources"] = [normalize_svg(raw("gi-water-drop"), "gi-water-drop")]
    elif change == "elements":
        data["steps"][2]["elements"][0]["x"] += 5
    elif change == "description":
        data["steps"][0]["description"] = "Changed outside target"
    elif change == "rows":
        data["steps"][0]["rows"][0]["speech"] = "Changed narration."
    elif change == "notes":
        data["notes"] = ["New global note"]
    else:
        data["subject"] = "Changed subject"
    candidate = VisualPlan.from_data(data, lesson().manifest())
    result = RevisionResult(
        data_fingerprint(prev.to_data()),
        lesson().manifest()["fingerprint"],
        "another",
        candidate,
        True,
        changed=True,
        target_step=1,
    )
    with pytest.raises(SceneError):
        revision_matches(result, prev, lesson().manifest())


def test_scoped_description_only_reply_keeps_previous_visual_and_does_not_claim_improvement():
    candidate = patch(elements=previous().to_data()["steps"][1]["elements"])
    result = run(scoped_request(), ModelTransport(candidate))
    assert not result.changed and result.plan == previous()


def test_scoped_full_lesson_origin_is_retained_and_not_sent_to_the_model():
    from pathlib import Path

    draft = LessonDraft.load(
        Path(__file__).resolve().parents[1] / "examples/complete-lesson-demo.json"
    )
    compiled = draft.compile()
    source = replace(compiled, visuals=None).manifest()
    req = scoped_request(plan=compiled.visuals, manifest=source)
    _, content = revision_prompt(req)
    assert "origin" not in json.loads(content)["previous_visual_plan"]
    result = run(
        req, ModelTransport(patch(req, elements=[dict(kind="circle", row=0, x=90, y=90, r=25)]))
    )
    assert result.plan.to_data()["schema"] == 2
    assert result.plan.to_data()["origin"] == compiled.visuals.to_data()["origin"]
    assert revision_matches(result, compiled.visuals, source)
    with pytest.raises(SceneError, match="ناقصة"):
        run(req, ModelTransport(patch(req, elements=[])))


def test_cancelled_scoped_model_result_is_not_merged(tmp_path):
    cancel = Event()
    model = ModelTransport(patch(), cancel=cancel)
    req = scoped_request()
    before = req.previous.payload_json
    with pytest.raises(Cancelled):
        run(req, model, tmp_path=tmp_path, cancel=cancel)
    assert req.previous.payload_json == before and len(model.calls) == 1


def test_scoped_sacred_policy_blocks_every_network_before_patch_or_preparation(tmp_path):
    data = empty_plan(lesson().manifest())
    data["policy"] = "sacred"
    prev = VisualPlan.from_data(data, lesson().manifest())
    model, blobs = ModelTransport(), BlobTransport()
    with pytest.raises(SceneError, match="النصوص المقدسة"):
        run(scoped_request("external", plan=prev), model, blobs, tmp_path)
    assert not model.calls and not blobs.calls


def test_outside_pending_cache_is_never_read_during_target_exclusive_preparation(
    monkeypatch, tmp_path
):
    from nova_voice import secondary_assets

    prev = assets_in(target="gi-magnifying-glass", outside="gi-water-drop")
    checked = []

    def cached(identifier, directory):
        checked.append(identifier)
        assert identifier != "gi-water-drop", "An outside pending ID must stay a local fallback"
        return normalize_svg(raw(identifier), identifier)

    monkeypatch.setattr(secondary_assets, "_cached", cached)
    req = scoped_request("external", plan=prev, key="", adult=False, send_consent=False)
    blobs = BlobTransport()
    result = run(req, ModelTransport(), blobs, tmp_path)
    assert checked == ["gi-magnifying-glass"] and not blobs.calls
    assert revision_matches(result, prev, req.source)


def test_scoped_delivery_requires_exact_boolean_changed_flag():
    req = scoped_request()
    result = run(req, ModelTransport(patch(req)))
    assert not revision_matches(replace(result, changed=1), req.previous, req.source)
