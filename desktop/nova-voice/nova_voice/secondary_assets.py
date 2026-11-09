"""Opt-in, pinned artwork, NOT a search engine, plugin loader or script interpreter.

The model may suggest catalogue IDs plus original local fallbacks. Only an explicit
prepare operation reads the private cache; only a separately approved operation
may GET the pinned public GitHub blobs. Render/import/export never use the network.
No upstream markup, scripts, styles, URLs or executable code reach the renderer.
"""

import base64
import hashlib
import json
import math
import os
import re
import ssl
import tempfile
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from threading import Event
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request, build_opener

from .scenes import NUMBER, PATH, SceneError, VisualPlan, _integer, _require, _unique
from .storage import resource_dir, user_data_dir
from .timing import data_fingerprint
from .voices import Cancelled, check_cancelled

CATALOG_PIN = "82d948812bfe3f269ef8f731dcdb07b08160edc4"
MAX_SELECTED = 6
MAX_REFERENCES = 24
MAX_FALLBACK_PARTS = 8
MAX_BLOB_BYTES = 8192
MAX_RESPONSE_BYTES = 32 * 1024
NETWORK_TIMEOUT = 20
READ_SECONDS = 30
FALLBACK_KINDS = (
    "rect",
    "circle",
    "ellipse",
    "line",
    "arrow",
    "polygon",
    "polyline",
    "text",
    "icons",
    "sector",
)
FALLBACK_FORBIDDEN = {"until", "motion", "dx", "dy", "gradient"}
CREDIT_FIELDS = {"title", "author", "attribution", "source", "license", "license_url", "changes"}
RESOURCE_RULES = """
OPTIONAL SECONDARY ARTWORK (enabled by the teacher; NOT an asset picker):
Prefer original local drawings. When a static symbol helps the SCRIPT, you MAY
choose an ID from secondary_asset_catalog below, not URLs or arbitrary libraries.
Only one extra kind: asset, with REQUIRED asset_id, name(meaning<=80), x,y,
w,h(integer24..300, entire box inside1000x420), fill(explicit #RRGGBB),
fallback(array1..8 ORIGINAL built-in static parts, not copied external artwork).
The external silhouette fits uniformly in that box, NEVER becomes an articulated
actor, verified diagram, literal electron orbit or growth simulation. Use groups
of original parts instead when the meaning requires articulation/anatomy.
Fallback parts use a LOCAL100x100 box and the SAME global row as the asset.
Each fallback has kind,row,x,y and ordinary shape keys; allowed kinds ONLY:
rect,circle,ellipse,line,arrow,polygon,polyline,text,icons,sector. Keep every part
inside100x100. Text<=30,size12..32; icons count<=4. No group/path/asset/sphere,
until,motion,dx,dy,gradient in fallback. All fallback parts count toward existing
node/depth budgets. Their colours are explicit; styles are not inherited.
The outer asset uses the ordinary row/until and motion grammar, default NONE;
no gradient or sequence fill/spin. Moving a silhouette is NOT walking/wing joints.
Max6 distinct IDs and24 references in the ENTIRE plan/draft. Never emit resources,
paths, credit data or a download URL: only the local application can prepare them.
Download is NOT automatic; without prepared data the original local fallback is
shown. No suitable ID? Draw with original primitives. No paid or unknown source.
"""


def _exact(value, fields):
    _require(isinstance(value, dict) and set(value) == fields, "بيانات المورد الثانوي غير صالحة.")


@lru_cache(maxsize=1)
def _catalog_json() -> str:
    data = json.loads((resource_dir() / "assets/secondary-catalog.json").read_text("utf-8"))
    _exact(
        data,
        {
            "schema",
            "revision",
            "provider",
            "repository",
            "pin",
            "max_selected",
            "max_references",
            "entries",
        },
    )
    _require(data["schema"] == 1 and data["revision"] == 1)
    _require(data["repository"] == "game-icons/icons" and data["pin"] == CATALOG_PIN)
    _require(data["max_selected"] == MAX_SELECTED and data["max_references"] == MAX_REFERENCES)
    _require(isinstance(data["entries"], list) and 1 <= len(data["entries"]) <= 32)
    seen = set()
    for entry in data["entries"]:
        _exact(
            entry,
            {
                "id",
                "label_ar",
                "description",
                "upstream_path",
                "blob_sha1",
                "raw_sha256",
                "raw_bytes",
                "drawing_fingerprint",
                "credit",
            },
        )
        _require(isinstance(entry["id"], str) and bool(re.fullmatch(r"gi-[a-z0-9-]+", entry["id"])))
        _require(entry["id"] not in seen)
        seen.add(entry["id"])
        _require(
            isinstance(entry["upstream_path"], str)
            and bool(re.fullmatch(r"[a-z0-9-]+/[a-z0-9-]+\.svg", entry["upstream_path"]))
        )
        for key, length in (("blob_sha1", 40), ("raw_sha256", 64), ("drawing_fingerprint", 64)):
            _require(
                isinstance(entry[key], str)
                and bool(re.fullmatch(r"[0-9a-f]{" + str(length) + r"}", entry[key]))
            )
        _require(_integer(entry["raw_bytes"], 1, MAX_BLOB_BYTES))
        credit = entry["credit"]
        _exact(credit, CREDIT_FIELDS)
        _require(all(isinstance(v, str) and 0 < len(v) <= 240 for v in credit.values()))
        _require(
            credit["source"]
            == (f"https://github.com/game-icons/icons/blob/{CATALOG_PIN}/{entry['upstream_path']}")
        )
        _require(
            credit["license"] == "CC-BY-3.0"
            and credit["license_url"] == ("https://creativecommons.org/licenses/by/3.0/")
        )
        _require(credit["attribution"] == "Icons made by " + credit["author"])
    return json.dumps(data, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def catalog() -> dict:
    """Copies only: callers cannot change the pinned allowlist in memory."""
    return json.loads(_catalog_json())


def asset_info(identifier: str) -> dict:
    _require(isinstance(identifier, str), "معرّف المورد الثانوي غير صالح.")
    for entry in catalog()["entries"]:
        if entry["id"] == identifier:
            return entry
    raise SceneError("المورد ليس في القائمة المدققة؛ استخدم الرسم المحلي، لا رابطًا مجهولًا.")


def prompt_catalog() -> list[dict]:
    # No upstream paths, URLs or hashes are requested from the language model.
    return [{"id": e["id"], "meaning": e["description"]} for e in catalog()["entries"]]


def validate_asset_box(item: dict) -> None:
    asset_info(item.get("asset_id"))
    _require(isinstance(item.get("name"), str) and bool(item["name"].strip()))
    _require(_integer(item.get("w"), 24, min(300, 1000 - item["x"])))
    _require(_integer(item.get("h"), 24, min(300, 420 - item["y"])))
    _require(
        isinstance(item.get("fill"), str) and bool(re.fullmatch(r"#[0-9a-fA-F]{6}", item["fill"]))
    )
    _require("gradient" not in item)
    fallback = item.get("fallback")
    _require(
        isinstance(fallback, list) and 1 <= len(fallback) <= MAX_FALLBACK_PARTS,
        "المورد يحتاج بديلًا محليًا أصليًا من 1 إلى 8 أجزاء ثابتة.",
    )
    for part in fallback:
        _require(isinstance(part, dict) and part.get("kind") in FALLBACK_KINDS)
        _require(not FALLBACK_FORBIDDEN.intersection(part) and part.get("row") == item["row"])
        _require(_integer(part.get("x"), 0, 100) and _integer(part.get("y"), 0, 100))
        kind, x, y = part["kind"], part["x"], part["y"]
        if kind == "rect":
            _require(_integer(part.get("w"), 1, 100 - x) and _integer(part.get("h"), 1, 100 - y))
        elif kind in ("circle", "sector"):
            _require(_integer(part.get("r"), 1, min(x, y, 100 - x, 100 - y)))
        elif kind == "ellipse":
            _require(_integer(part.get("rx"), 1, min(x, 100 - x)))
            _require(_integer(part.get("ry"), 1, min(y, 100 - y)))
        elif kind in ("line", "arrow"):
            _require(_integer(part.get("x2"), 0, 100) and _integer(part.get("y2"), 0, 100))
        elif kind in ("polygon", "polyline"):
            points = part.get("points")
            _require(isinstance(points, list))
            for point in points:
                _require(
                    isinstance(point, list)
                    and len(point) == 2
                    and all(_integer(v, 0, 100) for v in point)
                )
        elif kind == "text":
            _require(isinstance(part.get("text"), str) and len(part["text"]) <= 30)
            _require(_integer(part.get("size", 28), 12, 32))
        elif kind == "icons":
            count, columns, size = part.get("count"), part.get("columns"), part.get("size")
            _require(_integer(count, 0, 4) and _integer(columns, 1, 4) and _integer(size, 24, 100))
            _require(x + min(count, columns) * size <= 100)
            _require(y + math.ceil(count / columns) * size <= 100)


def _paths_valid(paths) -> bool:
    if not isinstance(paths, list) or not 1 <= len(paths) <= 4:
        return False
    for path in paths:
        if not isinstance(path, str) or not 1 <= len(path) <= MAX_BLOB_BYTES:
            return False
        if not PATH.fullmatch(path) or not path.lstrip().startswith(("M", "m")):
            return False
        numbers = NUMBER.findall(path)
        if len(numbers) > 1600 or not all(
            math.isfinite(float(v)) and abs(float(v)) <= 4096 for v in numbers
        ):
            return False
    return True


def validate_resource(resource: dict) -> None:
    _exact(resource, {"id", "paths", "credit"})
    entry = asset_info(resource["id"])
    _require(resource["credit"] == entry["credit"], "لا تحذف نسبة المورد أو تغيّر مصدره وترخيصه.")
    _require(_paths_valid(resource["paths"]), "مسارات المورد ليست رسومات رقمية محدودة.")
    _require(
        data_fingerprint({"view_box": [0, 0, 512, 512], "paths": resource["paths"]})
        == entry["drawing_fingerprint"],
        "رسم المورد لا يطابق النسخة المدققة؛ سيبقى البديل المحلي.",
    )


def referenced_ids(steps: list[dict]) -> list[str]:
    from .scene_graph import walk_elements

    references = [
        e["asset_id"]
        for step in steps
        for e in walk_elements(step["elements"])
        if e["kind"] == "asset"
    ]
    _require(
        len(references) <= MAX_REFERENCES and len(set(references)) <= MAX_SELECTED,
        "حد الموارد الثانوية: 6 معرّفات مختلفة و24 استخدامًا في الخطة كلها.",
    )
    return sorted(set(references))


def validate_plan_resources(data: dict) -> None:
    identifiers = referenced_ids(data["steps"])
    resources = data.get("resources", [])
    _require(isinstance(resources, list) and len(resources) <= MAX_SELECTED)
    seen = []
    for resource in resources:
        validate_resource(resource)
        _require(resource["id"] in identifiers)
        seen.append(resource["id"])
    _require(seen == sorted(set(seen)), "موارد مكررة أو بترتيب غير قياسي في الخطة.")
    _require(data.get("policy", "general") == "general" or not (resources or identifiers))


def validate_model_proposal(data: dict, *, enabled: bool) -> None:
    _require(type(enabled) is bool)
    _require("resources" not in data, "المزوّد يقترح المعرّفات فقط؛ تجهيز الرسوم عملية محلية منفصلة.")
    identifiers = referenced_ids(data["steps"])
    _require(enabled or not identifiers, "اقتُرحت موارد ثانوية دون تفعيلها؛ لم تُستخدم الخطة.")


def normalize_svg(raw: bytes, identifier: str) -> dict:
    """Audit only the pinned two-path monochrome subset; never sanitize arbitrary SVG."""
    entry = asset_info(identifier)
    _require(
        isinstance(raw, bytes)
        and len(raw) == entry["raw_bytes"]
        and hashlib.sha256(raw).hexdigest() == entry["raw_sha256"],
        "ملف المورد لا يطابق البصمة والحجم المثبتين.",
    )
    _require(len(raw) <= MAX_BLOB_BYTES and b"<!" not in raw and b"<?" not in raw)
    try:
        root = ET.fromstring(raw.decode("utf-8"))
        children = list(root)
        _require(
            root.tag == "{http://www.w3.org/2000/svg}svg"
            and root.attrib == {"viewBox": "0 0 512 512"}
        )
        _require(len(children) == 2 and not (root.text or "").strip())
        for child in children:
            _require(
                child.tag == "{http://www.w3.org/2000/svg}path"
                and not list(child)
                and not (child.text or "").strip()
                and not (child.tail or "").strip()
            )
        _require(children[0].attrib == {"d": "M0 0h512v512H0z"})
        _require(set(children[1].attrib) == {"fill", "d"} and children[1].get("fill") == "#fff")
        resource = {"id": identifier, "paths": [children[1].attrib["d"]], "credit": entry["credit"]}
        validate_resource(resource)
        return resource
    except (ET.ParseError, UnicodeError, KeyError, ValueError):
        raise SceneError("صيغة المورد ليست مجموعة SVG المدققة؛ لم يُستورد كود أو رابط.") from None


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _open(request: Request, *, timeout: int):
    return build_opener(
        ProxyHandler({}), _NoRedirect(), HTTPSHandler(context=ssl.create_default_context())
    ).open(request, timeout=timeout)


def download_resource(
    identifier: str, cancel: Event, *, consent: bool = False, _transport: Callable = _open
) -> dict:
    check_cancelled(cancel)
    _require(consent is True, "تنزيل الموارد يحتاج موافقة مستقلة على هذا الطلب.")
    entry = asset_info(identifier)
    endpoint = "https://api.github.com/repos/game-icons/icons/git/blobs/" + entry["blob_sha1"]
    request = Request(
        endpoint,
        method="GET",
        headers={
            "Accept": "application/vnd.github+json",
            "Accept-Encoding": "identity",
            "User-Agent": "NovaVoice-optional-artwork/1",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    chunks, size = [], 0
    deadline = time.monotonic() + READ_SECONDS
    try:
        with _transport(request, timeout=NETWORK_TIMEOUT) as response:
            check_cancelled(cancel)
            _require(
                response.status == 200 and response.geturl() == endpoint,
                "المصدر رفض المورد أو حاول تغيير العنوان؛ استُخدم البديل المحلي.",
            )
            _require(response.headers.get("Content-Encoding", "identity") in ("", "identity"))
            _require(
                response.headers.get("Content-Type", "").split(";")[0]
                in ("application/json", "application/vnd.github+json")
            )
            reader = getattr(response, "read1", response.read)
            while True:
                check_cancelled(cancel)
                _require(
                    time.monotonic() <= deadline, "انتهت مهلة المورد؛ لا إعادة محاولة تلقائية."
                )
                block = reader(min(8192, MAX_RESPONSE_BYTES + 1 - size))
                if not block:
                    break
                size += len(block)
                _require(size <= MAX_RESPONSE_BYTES, "تجاوز رد المورد الحد الآمن.")
                chunks.append(block)
        check_cancelled(cancel)
        data = json.loads(b"".join(chunks).decode("utf-8"), object_pairs_hook=_unique)
        _require(
            isinstance(data, dict)
            and data.get("sha") == entry["blob_sha1"]
            and type(data.get("size")) is int
            and data["size"] == entry["raw_bytes"]
            and data.get("encoding") == "base64"
            and isinstance(data.get("content"), str)
        )
        raw = base64.b64decode("".join(data["content"].split()), validate=True)
        result = normalize_svg(raw, identifier)
        check_cancelled(cancel)
        return result
    except HTTPError as error:
        error.close()
        check_cancelled(cancel)
        raise SceneError(
            "المصدر المجاني غير متاح أو انتهى حد الطلبات؛ لا دفع أو مصدر بديل."
        ) from None
    except (SceneError, Cancelled):
        raise
    except Exception:
        check_cancelled(cancel)
        raise SceneError(
            "تعذّر تنزيل المورد بأمان؛ استُخدم البديل المحلي دون إعادة محاولة."
        ) from None


def cache_directory() -> Path:
    return user_data_dir() / "secondary-assets-v1"


def _cache_path(identifier: str, directory: Path) -> Path:
    return directory / (asset_info(identifier)["raw_sha256"] + ".json")


def _cached(identifier: str, directory: Path) -> dict | None:
    path = _cache_path(identifier, directory)
    try:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_RESPONSE_BYTES:
            return None
        with path.open("rb") as stream:
            raw = stream.read(MAX_RESPONSE_BYTES + 1)
        _require(len(raw) <= MAX_RESPONSE_BYTES)
        result = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique)
        validate_resource(result)
        _require(result["id"] == identifier)
        return result
    except (OSError, SceneError, ValueError, UnicodeError, RecursionError):
        return None


def _save_cache(resource: dict, directory: Path, cancel: Event):
    validate_resource(resource)
    check_cancelled(cancel)
    directory.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".nova-asset-", dir=directory)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(resource, stream, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
            stream.flush()
            os.fsync(stream.fileno())
        check_cancelled(cancel)
        temporary.replace(_cache_path(resource["id"], directory))
    finally:
        temporary.unlink(missing_ok=True)


def clear_cache(directory: Path | None = None) -> int:
    """Only known hash-named entries, never voices/settings/HTML or recursive deletion."""
    directory = directory if directory is not None else cache_directory()
    count = 0
    for entry in catalog()["entries"]:
        path = _cache_path(entry["id"], directory)
        if path.is_file() or path.is_symlink():
            path.unlink()
            count += 1
    return count


@dataclass(frozen=True)
class AssetPreparation:
    base_fingerprint: str
    source_fingerprint: str
    plan: VisualPlan = field(repr=False)
    outcomes: tuple[tuple[str, str], ...]

    def summary(self) -> str:
        return "\n".join(identifier + " · " + outcome for identifier, outcome in self.outcomes)


def prepare_plan(
    plan: VisualPlan,
    source: dict,
    cancel: Event,
    progress: Callable[[int], None],
    *,
    allow_download: bool = False,
    directory: Path | None = None,
    _transport: Callable = _open,
) -> AssetPreparation:
    """Explicit immutable preparation, no adoption/narration/export or secret data sent."""
    check_cancelled(cancel)
    _require(type(allow_download) is bool)
    plan = VisualPlan.from_data(plan.to_data(), source)
    data = plan.to_data()
    _require(data["policy"] == "general", "لا موارد ثانوية في حماية النصوص المقدسة.")
    identifiers = referenced_ids(data["steps"])
    _require(bool(identifiers), "لا موارد ثانوية مقترحة في هذه الخطة؛ الرسم المحلي كافٍ.")
    existing = {r["id"]: r for r in data.get("resources", [])}
    directory = directory if directory is not None else cache_directory()
    outcomes, resources = [], []
    for index, identifier in enumerate(identifiers):
        check_cancelled(cancel)
        progress(int(index / len(identifiers) * 100))
        resource = existing.get(identifier)
        outcome = "مضمّن ومدقق بالفعل"
        if resource is None:
            resource = _cached(identifier, directory)
            outcome = "من الذاكرة المحلية بعد فحص البصمة"
        if resource is None and allow_download:
            try:
                resource = download_resource(
                    identifier, cancel, consent=True, _transport=_transport
                )
                outcome = "نُزّل من المصدر المثبت وفُحص"
                try:
                    _save_cache(resource, directory, cancel)
                except OSError:
                    outcome += "؛ تعذّر حفظ الذاكرة، لكنه مضمّن في الخطة"
            except SceneError:
                resource = None
                outcome = "تعذّر التنزيل/الفحص؛ البديل المحلي الأصلي"
        elif resource is None:
            outcome = "غير موجود محليًا؛ البديل المحلي الأصلي، دون اتصال"
        if resource is not None:
            resources.append(resource)
        outcomes.append((identifier, outcome))
    check_cancelled(cancel)
    if resources:
        data["resources"] = resources
    else:
        data.pop("resources", None)
    prepared = VisualPlan.from_data(data, source)
    check_cancelled(cancel)
    progress(100)
    return AssetPreparation(
        data_fingerprint(plan.to_data()), source["fingerprint"], prepared, tuple(outcomes)
    )


def use_local_fallbacks(plan: VisualPlan, source: dict) -> VisualPlan:
    plan = VisualPlan.from_data(plan.to_data(), source)
    data = plan.to_data()
    data.pop("resources", None)
    return VisualPlan.from_data(data, source)


def preparation_matches(result: AssetPreparation, current: VisualPlan, source: dict) -> bool:
    current = VisualPlan.from_data(current.to_data(), source)
    candidate = VisualPlan.from_data(result.plan.to_data(), source).to_data()
    original = current.to_data()
    candidate.pop("resources", None)
    original.pop("resources", None)
    return (
        candidate == original
        and result.source_fingerprint == source["fingerprint"]
        and result.base_fingerprint == data_fingerprint(current.to_data())
    )


def credits(plan: VisualPlan | None) -> list[dict]:
    return [r["credit"] for r in plan.to_data().get("resources", [])] if plan else []
