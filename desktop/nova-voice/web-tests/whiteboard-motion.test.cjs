"use strict";
// Shared-schema and deterministic SVG contracts only; JSDOM is not video QA.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { mount, jsonFrom, replaceJSON, resign } = require("./scene-harness.cjs");
const root = path.resolve(__dirname, ".."), examples = path.join(root, "examples");
const cases = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/motion-cases.json"), "utf8"));
const DATA = "nova-whiteboard-data";
const shape = motion => ({ kind: "circle", row: 0, x: 500, y: 210, r: 30, motion });
function app(motion) {
  return mount(examples, { file: "visual-scenes.html", transform: raw => {
    const data = jsonFrom(raw, DATA);
    data.visuals.steps[0].elements[0].motion = motion;
    return replaceJSON(raw, DATA, resign(data));
  } });
}
for (const [valid, vectors] of [[true, cases.valid], [false, cases.invalid]]) {
  vectors.forEach((motion, index) => test(`shared motion validation ${valid ? "accepts" : "rejects"} vector ${index}`, () => {
    const a = app(motion);
    try {
      assert.equal(a.get("wb-play").disabled, !valid);
      a.get("wb-output-review").checked = true;
      a.get("wb-output-review").dispatchEvent(new a.window.Event("change"));
      assert.equal(a.get("wb-print").disabled, !valid);
      if (!valid) assert.equal(a.document.querySelectorAll("[data-scene-element]").length, 0);
    } finally { a.close(); }
  }));
}
function view(a, motion, until = 2) {
  const svg = a.document.createElementNS("http://www.w3.org/2000/svg", "svg");
  a.document.body.append(svg);
  const model = a.window.novaWhiteboardScenes.mount(svg, { elements: [{ ...shape(motion), until }] }, 1070, 0, "test");
  return { ...model, g: svg.querySelector("[data-scene-element]") };
}
const bounds = [{ start: 1, end: 5 }, { start: 5, end: 7 }];

test("path follows arc length across corners, holds its end and reverses without timers", () => {
  const a = app({ type: "none" });
  try {
    const v = view(a, { type: "path", points: [[0, 0], [100, 0], [100, 100]] });
    for (const [time, transform] of [[2, "translate(50 0)"], [3, "translate(100 0)"], [4, "translate(100 50)"], [6, "translate(100 100)"], [2, "translate(50 0)"]]) {
      v.update(bounds, time, false); assert.equal(v.g.getAttribute("transform"), transform);
    }
    v.update(bounds, 0, false); assert.equal(v.g.getAttribute("opacity"), "0");
    assert.equal(a.frames, 0);
  } finally { a.close(); }
});

test("smoothstep is optional, deterministic and does not change legacy linear moves", () => {
  const a = app({ type: "none" });
  try {
    for (const [motion, expected] of [
      [{ type: "move", dx: 100, dy: 0 }, "translate(25 0)"],
      [{ type: "move", dx: 100, dy: 0, ease: "smooth" }, "translate(15.625 0)"],
      [{ type: "path", points: [[0, 0], [100, 0]], ease: "smooth" }, "translate(15.625 0)"],
    ]) { const v = view(a, motion); v.update(bounds, 2, false); assert.equal(v.g.getAttribute("transform"), expected); }
  } finally { a.close(); }
});

test("rotation uses an explicit fixed pivot, holds and reverse seek restores the angle", () => {
  const a = app({ type: "none" });
  try {
    const v = view(a, { type: "rotate", degrees: -180, cx: 500, cy: 210 });
    for (const [time, degrees] of [[2, -45], [3, -90], [6, -180], [2, -45]]) {
      v.update(bounds, time, false); assert.equal(v.g.getAttribute("transform"), `translate(0 0) rotate(${degrees} 500 210)`);
    }
  } finally { a.close(); }
});

test("reduced motion removes route/rotation but respects exclusive until cues", () => {
  const a = app({ type: "none" });
  try {
    for (const motion of [cases.valid[1], cases.valid[4]]) {
      const v = view(a, motion, 1);
      v.update(bounds, 3, true); assert.equal(v.g.getAttribute("transform"), "translate(0 0)");
      assert.equal(v.g.getAttribute("opacity"), "1");
      v.update(bounds, 5, true); assert.equal(v.g.getAttribute("opacity"), "0");
      v.update(bounds, 3, true); assert.equal(v.g.getAttribute("opacity"), "1");
    }
  } finally { a.close(); }
});

test("print poses freeze start/middle/end with fully drawn shapes and no live timers", () => {
  const a = app({ type: "none" });
  try {
    const v = view(a, { type: "rotate", degrees: 180, cx: 500, cy: 210 });
    for (const [pose, degrees] of [[0, 0], [0.5, 90], [1, 180]]) {
      v.update(bounds, 4.9999, false, true, pose);
      assert.equal(v.g.getAttribute("transform"), `translate(0 0) rotate(${degrees} 500 210)`);
      assert.equal(v.g.querySelector("[stroke-dasharray]"), null);
    }
    assert.equal(a.frames, 0);
  } finally { a.close(); }
});

test("advanced example prints three movement phases, preserves exact words and saves no approval", () => {
  const a = mount(examples, { file: "advanced-motion-demo.html", captureDownloads: true });
  try {
    const original = jsonFrom(a.get(DATA).outerHTML, DATA);
    a.get("wb-output-review").checked = true; a.get("wb-output-review").dispatchEvent(new a.window.Event("change"));
    a.get("wb-print-preview").click();
    assert.equal(a.document.querySelectorAll(".print-step").length, 10);
    const text = [...a.document.querySelectorAll(".print-speech")].map(n => n.textContent);
    assert.deepEqual(text, original.steps.flatMap(s => s.rows.map(r => r.text)));
    const phases = [...a.document.querySelectorAll("figcaption")].map(n => n.textContent);
    const starts = phases.filter(t => t.includes("بداية الحركة")).length;
    assert.ok(starts >= 4);
    assert.equal(phases.filter(t => t.includes("منتصف الحركة")).length, starts);
    assert.equal(phases.filter(t => t.includes("نهاية الحركة")).length, starts);
    assert.equal(a.document.querySelectorAll("#wb-print-root [stroke-dasharray]").length, 0);
    a.get("wb-save-customized").click();
    assert.ok(!a.downloads[0].includes('data-print-step="'));
    assert.deepEqual(jsonFrom(a.downloads[0], DATA), original);
    assert.equal(a.networkCalls, 0);
  } finally { a.close(); }
});
