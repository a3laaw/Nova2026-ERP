"""Composable vector actors, not animal/subject templates or a keyword planner.

All poses are pure functions of source-row progress. The model chooses parts and
keyframes; neither this module nor the renderer interprets a script by keywords.
No generated code, external assets, third-party downloads or model requests here.
"""

import math

from .scenes import COLOR, _integer, _keys, _require, _text

MAX_DEPTH = 3
MAX_CHILDREN = 20
MAX_SPHERES = 3
FRAME_FIELDS = {"dx", "dy", "angle", "scale", "opacity", "fill", "spin"}
FRAME_DEFAULTS = {"dx": 0, "dy": 0, "angle": 0, "scale": 100, "opacity": 100, "spin": 0}


def validate_style(item):
    if "name" in item:
        _require(_text(item["name"], 80))
    if "gradient" in item:
        gradient = item["gradient"]
        _keys(gradient, {"color", "axis"})
        _require(item["kind"] not in ("group", "icons", "calculation"))
        _require(isinstance(item.get("fill"), str) and bool(COLOR.fullmatch(item["fill"])))
        _require(isinstance(gradient["color"], str) and bool(COLOR.fullmatch(gradient["color"])))
        _require(gradient["axis"] in ("horizontal", "vertical", "radial"))


def validate_motion(item, rows):
    motion = item["motion"]
    if motion["type"] == "curve":
        _keys(motion, {"type", "points", "ease"}, {"type", "points"})
        points = motion["points"]
        _require(isinstance(points, list) and len(points) in (3, 4))
        for point in points:
            _require(
                isinstance(point, list)
                and len(point) == 2
                and _integer(point[0], -300, 300)
                and _integer(point[1], -180, 180)
            )
        _require(points[0] == [0, 0] and any(point != [0, 0] for point in points[1:]))
        _require(motion.get("ease", "linear") in ("linear", "smooth"))
        return
    _keys(
        motion,
        {"type", "frames", "repeat", "span", "cx", "cy", "ease"},
        {"type", "frames"},
    )
    frames = motion["frames"]
    _require(isinstance(frames, list) and 2 <= len(frames) <= 8)
    repeat, span = motion.get("repeat", 1), motion.get("span", 1)
    _require(_integer(repeat, 1, 6))
    _require(_integer(span, 1, item.get("until", rows) - item["row"]))
    _require(_integer(motion.get("cx", 0), 0, 1000))
    _require(_integer(motion.get("cy", 0), 0, 420))
    _require(motion.get("ease", "linear") in ("linear", "smooth"))
    fields = None
    previous = -1
    for frame in frames:
        _keys(frame, {"at"} | FRAME_FIELDS, {"at"})
        current = set(frame) - {"at"}
        _require(current and (fields is None or current == fields))
        fields = current
        _require(_integer(frame["at"], 0, 1000) and frame["at"] > previous)
        previous = frame["at"]
        for key, low, high in (
            ("dx", -300, 300),
            ("dy", -180, 180),
            ("angle", -720, 720),
            ("scale", 25, 200),
            ("opacity", 0, 100),
            ("spin", -720, 720),
        ):
            if key in frame:
                _require(_integer(frame[key], low, high))
        if "spin" in frame:
            _require(item["kind"] == "sphere")
        if "fill" in frame:
            _require(item["kind"] not in ("group", "icons", "calculation"))
            _require("gradient" not in item and isinstance(item.get("fill"), str))
            _require(bool(COLOR.fullmatch(item["fill"])))
            _require(isinstance(frame["fill"], str) and bool(COLOR.fullmatch(frame["fill"])))
    _require(frames[0]["at"] == 0 and frames[-1]["at"] == 1000)
    if repeat > 1:
        # No flashing alpha/color loops or jumps between gait cycles. Rotation
        # may end one complete turn away from its start, including surface spin.
        _require(not fields.intersection({"fill", "opacity"}))
        for key in fields:
            difference = frames[-1][key] - frames[0][key]
            _require(difference % 360 == 0 if key in ("angle", "spin") else difference == 0)


def validate_geometry(item):
    if item["kind"] == "sector":
        _require(_integer(item.get("r"), 1, 200))
        _require(_integer(item.get("inner", 0), 0, item["r"] - 1))
        _require(_integer(item.get("start"), -360, 360))
        _require(_integer(item.get("sweep"), 1, 360))
    elif item["kind"] == "sphere":
        _require(_integer(item.get("r"), 20, 180))
        _require(_integer(item.get("longitude", 0), -180, 180))
        _require(_integer(item.get("tilt", 0), -45, 45))
        _require(type(item.get("grid", True)) is bool)
        patches = item.get("patches", [])
        _require(isinstance(patches, list) and len(patches) <= 8)
        for patch in patches:
            _keys(patch, {"points", "fill"})
            _require(isinstance(patch["fill"], str) and bool(COLOR.fullmatch(patch["fill"])))
            points = patch["points"]
            _require(isinstance(points, list) and 3 <= len(points) <= 24)
            for point in points:
                _require(
                    isinstance(point, list)
                    and len(point) == 2
                    and _integer(point[0], -180, 180)
                    and _integer(point[1], -85, 85)
                )
            _require(max(p[0] for p in points) - min(p[0] for p in points) <= 120)
            _require(max(p[1] for p in points) - min(p[1] for p in points) <= 120)
            _require(len({tuple(point) for point in points}) >= 3)


def curve_position(points, fraction):
    """Quadratic/cubic Bezier; parameter-based, not constant physical speed."""
    work = [[float(value) for value in point] for point in points]
    fraction = max(0, min(1, fraction))
    while len(work) > 1:
        work = [
            [a + (b - a) * fraction for a, b in zip(left, right, strict=True)]
            for left, right in zip(work, work[1:], strict=False)
        ]
    return work[0]


def sequence_state(motion, fraction):
    """No timer/cumulative state; reverse seeking gives the exact same pose."""
    fraction = max(0, min(1, fraction))
    repeated = fraction * motion.get("repeat", 1)
    local = 1 if fraction >= 1 else repeated - math.floor(repeated)
    at = local * 1000
    frames = motion["frames"]
    left, right = frames[-2:]
    for a, b in zip(frames, frames[1:], strict=False):
        if at <= b["at"]:
            left, right = a, b
            break
    part = max(0, min(1, (at - left["at"]) / (right["at"] - left["at"])))
    if motion.get("ease") == "smooth":
        part = part * part * (3 - 2 * part)
    result = dict(FRAME_DEFAULTS)
    for key in left.keys() - {"at"}:
        if key == "fill":
            channels = [
                int(left[key][offset : offset + 2], 16)
                + (
                    int(right[key][offset : offset + 2], 16)
                    - int(left[key][offset : offset + 2], 16)
                )
                * part
                for offset in (1, 3, 5)
            ]
            result[key] = "#" + "".join(f"{math.floor(v + 0.5):02X}" for v in channels)
        else:
            result[key] = left[key] + (right[key] - left[key]) * part
    return result


def sphere_point(longitude, latitude, spin=0, tilt=0):
    """Orthographic unit-sphere projection; z<0 is the invisible hemisphere.

    This is a geometric 2.5D illustration, not a GIS map or physical simulation.
    """
    lon, lat, turn = map(math.radians, (longitude + spin, latitude, tilt))
    x, y, z = math.cos(lat) * math.sin(lon), -math.sin(lat), math.cos(lat) * math.cos(lon)
    return [x * math.cos(turn) - y * math.sin(turn), x * math.sin(turn) + y * math.cos(turn), z]


def walk_parts(elements, parent=()):
    """Stable part paths for a previously validated tree, in painter order."""
    for index, element in enumerate(elements):
        path = (*parent, index + 1)
        yield path, element
        if element["kind"] == "group":
            yield from walk_parts(element["children"], path)


def walk_elements(elements):
    """For previously validated bounded trees only, preserving painter order."""
    for _, element in walk_parts(elements):
        yield element


def validate_elements(elements, rows):
    from .scenes import MAX_STEP_ELEMENTS, validate_element

    _require(isinstance(elements, list) and len(elements) <= MAX_STEP_ELEMENTS)
    budget = [0, 0]
    for item in elements:
        validate_element(item, rows, _budget=budget)
    return budget[0]
