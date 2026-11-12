"use strict";
// DOM/strict-schema contracts, NOT GPU/video quality or live script understanding.
const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { mount, jsonFrom, replaceJSON, resign } = require("./scene-harness.cjs");
const root = path.resolve(__dirname, ".."), examples = path.join(root, "examples");
const cases = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/graph-cases.json"), "utf8"));
const DATA = "nova-whiteboard-data";
function app(elements) {
  return mount(examples, { file: "visual-scenes.html", transform: raw => {
    if (!elements) return raw;
    const data = jsonFrom(raw, DATA); data.visuals.steps[0].elements = elements;
    return replaceJSON(raw, DATA, resign(data));
  } });
}
const plain = value => JSON.parse(JSON.stringify(value));
for (const [valid, vectors] of [[true, cases.valid], [false, cases.invalid]]) {
  for (const vector of vectors) test(`shared composition ${valid ? "accepts" : "rejects"}: ${vector.id}`, () => {
    const a = app(vector.elements);
    try {
      assert.equal(a.get("wb-play").disabled, !valid);
      a.get("wb-output-review").checked = true;
      a.get("wb-output-review").dispatchEvent(new a.window.Event("change"));
      assert.equal(a.get("wb-print").disabled, !valid);
      if (!valid) assert.equal(a.document.querySelectorAll("[data-scene-element]").length, 0);
    } finally { a.close(); }
  });
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
for (const vector of cases.math.curves) test(`shared pure Bezier ${vector.points.length} controls at ${vector.fraction}`, () => {
  const a = app(); try { a.window.novaSceneGraph.curvePosition(vector.points, vector.fraction).forEach((v, i) => near(v, vector.expected[i])); } finally { a.close(); }
});
for (const [i, vector] of cases.math.sequences.entries()) test(`shared pure sequence/color pose ${i}`, () => {
  const a = app(); try {
    const actual = plain(a.window.novaSceneGraph.sequenceState(vector.motion, vector.fraction));
    Object.keys(vector.expected).forEach(k => typeof vector.expected[k] === "number" ? near(actual[k], vector.expected[k]) : assert.equal(actual[k], vector.expected[k]));
  } finally { a.close(); }
});
for (const vector of cases.math.spheres) test(`shared pure spherical projection ${vector.longitude}/${vector.latitude}/${vector.spin}/${vector.tilt}`, () => {
  const a = app(); try { a.window.novaSceneGraph.spherePoint(vector.longitude, vector.latitude, vector.spin, vector.tilt).forEach((v, i) => near(v, vector.expected[i])); } finally { a.close(); }
});
function view(a, elements) {
  const svg = a.document.createElementNS("http://www.w3.org/2000/svg", "svg"); a.document.body.append(svg);
  const model = a.window.novaWhiteboardScenes.mount(svg, { elements }, 1070, 0, "test");
  return { ...model, svg, g: svg.querySelector('[data-scene-element="0"]') };
}
const bounds = [{ start: 1, end: 5 }, { start: 5, end: 9 }, { start: 9, end: 11 }];
const sequence = (frames, extra = {}) => ({ type: "sequence", frames, ...extra });
function actor() {
  return { kind: "group", name: "Arbitrary linked parts, not a template", row: 0, until: 2, x: 100, y: 50,
    motion: sequence([{ at: 0, dx: 0, angle: 0 }, { at: 1000, dx: 200, angle: 30 }], { span: 2, cx: 0, cy: 0 }),
    children: [{ kind: "rect", row: 0, x: 0, y: 0, w: 20, h: 70, fill: "#FFB000",
      motion: sequence([{ at: 0, angle: -30 }, { at: 500, angle: 30 }, { at: 1000, angle: -30 }], { span: 2, repeat: 2, cx: 0, cy: 0 }) },
    { kind: "group", name: "Joint chain", row: 0, x: 10, y: 70, children: [
      { kind: "ellipse", name: "Later part", row: 1, x: 15, y: 15, rx: 20, ry: 8, fill: "#2563EB",
        motion: sequence([{ at: 0, opacity: 0, scale: 50 }, { at: 1000, opacity: 100, scale: 100 }]) },
    ] }],
  };
}
test("parent transforms compose with independently animated joints and global row cues; seek is pure", () => {
  const a = app(); try {
    const v = view(a, [actor()]), child = v.svg.querySelector('[data-scene-element="0.0"]'), foot = v.svg.querySelector('[data-scene-element="0.1.0"]');
    v.update(bounds, 3, false);
    assert.equal(v.g.getAttribute("transform"), "translate(100 50) translate(50 0) translate(0 0) rotate(7.5) scale(1) translate(0 0)");
    assert.match(child.getAttribute("transform"), /rotate\(30\)/);
    assert.equal(foot.getAttribute("opacity"), "0");
    const first = v.g.outerHTML;
    v.update(bounds, 6, false);
    assert.match(v.g.getAttribute("transform"), /translate\(125 0\).*rotate\(18.75\)/);
    assert.equal(foot.getAttribute("opacity"), "0.25");
    assert.match(foot.getAttribute("transform"), /scale\(0.625\)/);
    v.update(bounds, 3, false); assert.equal(v.g.outerHTML, first);
    assert.equal(v.g.querySelectorAll("[stroke-dasharray]").length, 0); // parent never traces children
    assert.equal(a.frames, 0); // no actor-owned RAF/timer
    v.update(bounds, 9, false); assert.equal(v.g.getAttribute("opacity"), "0");
    assert.equal(child.getAttribute("opacity"), "0");
  } finally { a.close(); }
});

test("reduced motion restores base poses/colors but still reveals parts with source cues", () => {
  const a = app(); try {
    const v = view(a, [actor()]); v.update(bounds, 6, false); v.update(bounds, 6, true);
    assert.equal(v.g.getAttribute("transform"), "translate(100 50) translate(0 0) translate(0 0) rotate(0) scale(1) translate(0 0)");
    const foot = v.svg.querySelector('[data-scene-element="0.1.0"]'); assert.equal(foot.getAttribute("opacity"), "1");
    v.update(bounds, 3, true); assert.equal(foot.getAttribute("opacity"), "0");
    assert.equal(a.frames, 0);
  } finally { a.close(); }
});

test("a sphere rotates its projected front surface, hides the back and preserves shading/grid alpha", () => {
  const a = app(); try {
    const e = { kind: "sphere", row: 0, x: 500, y: 210, r: 150, fill: "#2563EB", patches: [{ fill: "#FFB000", points: [[-30,-20],[30,-20],[30,20],[-30,20]] }],
      motion: sequence([{ at: 0, spin: 0 }, { at: 1000, spin: 360 }]) };
    const v = view(a, [e]), patch = v.g.querySelector("[data-sphere-patch]"), grid = v.g.querySelector("[data-sphere-grid]");
    v.update(bounds, 1, false); const before = grid.getAttribute("d"); assert.ok(patch.getAttribute("d").length > 0);
    v.update(bounds, 2, false); assert.notEqual(grid.getAttribute("d"), before); assert.match(patch.getAttribute("d"), /A150 150/);
    v.update(bounds, 3, false); assert.equal(patch.getAttribute("d"), "");
    assert.ok(!v.svg.outerHTML.includes("NaN") && !v.svg.outerHTML.includes("Infinity"));
    assert.match(v.g.getAttribute("transform"), /rotate\(0\)/); // NOT a spinning flat SVG
    assert.equal(grid.getAttribute("opacity"), "0.38");
    v.update(bounds, 1, false); assert.equal(grid.getAttribute("d"), before);
    v.update(bounds, 4, false); v.update(bounds, 4, true); assert.equal(v.g.dataset.surfaceSpin, "0");
    assert.equal(grid.getAttribute("d"), before);
  } finally { a.close(); }
});

test("gradients use owned unique local defs and survive SVG serialization without external URLs", () => {
  const a = app(); try {
    const e = { kind: "circle", row: 0, x: 100, y: 100, r: 30, fill: "#2563EB", gradient: { color: "#FFB000", axis: "horizontal" } };
    const first = view(a, [e]), second = view(a, [e]);
    const paint = first.g.querySelector("circle").getAttribute("fill"); assert.match(paint, /^url\(#nova-graph-paint-\d+\)$/);
    assert.notEqual(first.svg.querySelector("linearGradient").id, second.svg.querySelector("linearGradient").id);
    assert.equal(first.svg.querySelectorAll("stop").length, 2);
    assert.ok(!new a.window.XMLSerializer().serializeToString(first.svg).includes("https://"));
  } finally { a.close(); }
});

test("full sectors/rings close their geometry; interpolated fills reset on reverse/reduced seek", () => {
  const a = app(); try {
    const e = { kind: "sector", row: 0, x: 400, y: 210, r: 100, inner: 70, start: -90, sweep: 360, fill: "#112233", motion: sequence([{ at: 0, fill: "#112233" }, { at: 1000, fill: "#F1E2D3" }]) };
    const v = view(a, [e]), path = v.g.querySelector("path"); assert.equal((path.getAttribute("d").match(/A/g) || []).length, 4);
    v.update(bounds, 3, false); assert.equal(path.getAttribute("fill"), "#818283");
    v.update(bounds, 1, false); assert.equal(path.getAttribute("fill"), "#112233");
    v.update(bounds, 4, false); v.update(bounds, 4, true); assert.equal(path.getAttribute("fill"), "#112233");
  } finally { a.close(); }
});

test("nested cues and repeated multi-row motion do not alias to identical printed poses", () => {
  const a = app(); try {
    const e = actor(); e.motion = undefined; delete e.motion;
    e.children[0].motion = sequence([{ at: 0, angle: 0 }, { at: 250, angle: 25 }, { at: 500, angle: 0 }, { at: 750, angle: -25 }, { at: 1000, angle: 0 }], { span: 2, repeat: 4, cx: 0, cy: 0 });
    const b = [{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }];
    const info = a.window.novaWhiteboardScenes.printInfo([e], 1, 3, b); assert.ok(info.poses.length <= 8 && info.poses.length > 3);
    const v = view(a, [e]), angles = new Set();
    for (const pose of info.poses) { v.update(b, 1.999999, false, true, pose); angles.add(v.g.querySelector('[data-scene-element="0.0"]').getAttribute("transform")); }
    assert.ok(angles.size >= 3, "sampling must show positive, negative and rest joint angles");
    const first = a.window.novaWhiteboardScenes.printInfo([e], 0, 3, b);
    assert.notEqual(info.key, first.key); assert.equal(info.visible, 2);
  } finally { a.close(); }
});

test("print span progress uses actual uneven row bounds, not equal row durations", () => {
  const a = app(); try {
    const e = actor(), b = [{ start: 0, end: 8 }, { start: 8, end: 9 }, { start: 9, end: 10 }];
    const v = view(a, [e]); v.update(b, 8.999999, false, true, 0);
    assert.match(v.g.getAttribute("transform"), /translate\(177.7778 0\)/);
    v.update(b, 8.999999, false, true, 1); assert.match(v.g.getAttribute("transform"), /translate\(200 0\)/);
  } finally { a.close(); }
});

test("authored demo prints every original row and nested reveal; saved data is not a saved approval", () => {
  const a = mount(examples, { file: "composition-demo.html", captureDownloads: true }); try {
    const original = jsonFrom(a.get(DATA).outerHTML, DATA);
    a.get("wb-output-review").checked = true; a.get("wb-output-review").dispatchEvent(new a.window.Event("change"));
    a.get("wb-print-preview").click();
    assert.equal(a.document.querySelectorAll(".print-step").length, 4);
    assert.deepEqual([...a.document.querySelectorAll(".print-speech")].map(n => n.textContent), original.steps.flatMap(s => s.rows.map(r => r.text)));
    assert.ok(a.document.querySelectorAll('figcaption').length >= 15);
    const reveal = a.document.querySelector('.print-step[data-print-step="2"]');
    assert.equal(reveal.querySelectorAll('[data-print-row="0"] figure').length, 1);
    assert.ok(reveal.querySelectorAll('[data-print-row="1"] figure').length > 1);
    assert.equal(reveal.querySelectorAll('[data-print-row="2"] figure').length, 1);
    assert.equal(a.document.querySelectorAll("#wb-print-root [stroke-dasharray]").length, 0);
    a.get("wb-save-customized").click(); assert.deepEqual(jsonFrom(a.downloads[0], DATA), original);
    assert.ok(!a.downloads[0].includes('data-print-step="'));
  } finally { a.close(); }
});

test("curve rendering interpolates Bezier, holds at the end and reverses without cumulative state", () => {
  const a = app(); try {
    const v = view(a, [{ kind: "circle", row: 0, x: 200, y: 210, r: 20, motion: { type: "curve", points: [[0,0],[100,-100],[200,0]] } }]);
    for (const [now, expected] of [[2,"translate(50 -37.5)"],[3,"translate(100 -50)"],[6,"translate(200 0)"],[2,"translate(50 -37.5)"]]) {
      v.update(bounds, now, false); assert.equal(v.g.getAttribute("transform"), expected);
    }
    v.update(bounds, 3, true); assert.equal(v.g.getAttribute("transform"), "translate(0 0)");
    assert.equal(a.frames, 0);
  } finally { a.close(); }
});

test("legacy common entrance offsets compose with a sequence instead of silently disappearing", () => {
  const a = app(); try {
    const v = view(a, [{ kind: "circle", row: 0, x: 200, y: 210, r: 20, dx: 60, dy: 30, motion: sequence([{ at: 0, dx: 0 }, { at: 1000, dx: 100 }]) }]);
    v.update(bounds, 1, false); assert.match(v.g.getAttribute("transform"), /^translate\(60 30\)/);
    v.update(bounds, 5, false); assert.match(v.g.getAttribute("transform"), /^translate\(100 0\)/);
    v.update(bounds, 1, true); assert.match(v.g.getAttribute("transform"), /^translate\(0 0\)/);
  } finally { a.close(); }
});
