"use strict";
// DOM/controller checks. CSP, origin isolation and real rendering are tested in
// browser-history.cjs separately; jsdom does NOT enforce those browser boundaries.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { JSDOM } = require("jsdom");
const { generate } = require("./history-fixture.cjs");
const { mount, jsonFrom } = require("./scene-harness.cjs");
let folder, expected;
before(() => { folder = fs.mkdtempSync(path.join(os.tmpdir(), "nova-history-dom-")); expected = generate(folder); });
after(() => fs.rmSync(folder, { recursive: true, force: true }));
function create(which = "before", options = {}) { const app = mount(folder, { file: which + ".html", ...options }); app.finishErase(); return app; }

test("comparison wraps two separately sandboxed data pages with no network/audio authority", () => {
  const doc = new JSDOM(fs.readFileSync(path.join(folder, "compare.html"), "utf8"));
  try {
    const frames = [...doc.window.document.querySelectorAll("iframe")];
    assert.equal(frames.length, 2);
    assert.ok(frames[0].title.includes("نسخة 1") && frames[1].title.includes("نسخة 2"));
    frames.forEach(frame => { assert.equal(frame.getAttribute("sandbox"), "allow-scripts"); assert.ok(frame.src.startsWith("data:text/html;base64,")); });
    const policy = doc.window.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
    assert.ok(policy.includes("connect-src 'none'") && policy.includes("media-src 'none'"));
    assert.equal(doc.window.document.querySelectorAll("script,audio,video,button,form").length, 0);
    assert.ok(doc.window.document.getElementById("changes").textContent.includes("2"));
  } finally { doc.window.close(); }
});

for (const which of ["before", "after"]) {
  test(`${which} is a real validated visual with the exact source, roles and reviewed speech`, () => {
    const app = create(which);
    try {
      const data = jsonFrom(fs.readFileSync(path.join(folder, which + ".html"), "utf8"), "nova-whiteboard-data");
      assert.deepEqual(data.visuals, expected[which]);
      for (const key of ["script", "title", "dialogue", "steps"]) assert.deepEqual(data[key], expected.source[key]);
      assert.equal(app.get("whiteboard").dataset.visuals, "validated");
      assert.equal(app.get("scene-title").textContent, expected.source.steps[1].title);
      assert.ok(app.get("step-transcript").textContent.includes("Reviewed spoken text."));
      assert.equal(app.mode, "silent"); assert.equal(app.audio.paused, true);
      assert.equal(app.get("nova-whiteboard-recordings"), null);
      assert.equal(app.get("wb-output-review").checked, false);
      assert.equal(app.window.getComputedStyle(app.get("wb-output")).display, "none");
      assert.equal(app.window.getComputedStyle(app.get("wb-customization")).display, "none");
    } finally { app.close(); }
  });
}

test("the changed scene really renders different geometry, not just a version number or description", () => {
  const a = create("before"), b = create("after");
  try {
    const drawing = app => app.get("wb-rows").innerHTML;
    assert.notEqual(drawing(a), drawing(b));
    assert.ok(a.document.querySelector('[data-scene-element="0"] circle'));
    assert.ok(b.document.querySelector('[data-scene-element="0"] rect'));
    for (const index of [0, 2]) {
      for (const app of [a, b]) { app.get("lesson-outline").querySelectorAll("button")[index].click(); app.finishErase(); }
      assert.equal(drawing(a), drawing(b));
    }
  } finally { a.close(); b.close(); }
});

test("independent silent playback, pause and navigation never operate the other side", () => {
  const a = create("before"), b = create("after");
  try {
    const fixed = b.get("wb-rows").innerHTML;
    a.get("wb-play").click(); a.advance(1000); a.advance(1400);
    assert.equal(b.get("wb-rows").innerHTML, fixed);
    assert.ok(a.get("wb-play").textContent.includes("إيقاف"));
    assert.equal(b.frames, 0);
    a.get("wb-play").click(); const paused = a.get("wb-rows").innerHTML;
    a.advance(4000); assert.equal(a.get("wb-rows").innerHTML, paused);
    a.get("wb-next").click(); a.finishErase();
    assert.equal(a.get("scene-title").textContent, expected.source.steps[2].title);
    assert.equal(b.get("scene-title").textContent, expected.source.steps[1].title);
    assert.equal(a.audio.src, ""); assert.equal(b.audio.src, "");
  } finally { a.close(); b.close(); }
});

test("reduced motion comparison still exposes the complete static selected drawing without starting a clock", () => {
  const app = create("after", { reducedMotion: true });
  try {
    assert.equal(app.frames, 0); assert.equal(app.audio.paused, true);
    assert.ok(!/NaN|Infinity/.test(app.get("whiteboard").outerHTML));
    assert.equal(app.get("scene-title").textContent, expected.source.steps[1].title);
    app.get("wb-play").click(); app.advance(0); app.advance(500);
    assert.ok(!/NaN|Infinity/.test(app.get("whiteboard").outerHTML));
  } finally { app.close(); }
});

test("HTML in source and title is literal in the parent and the independently decoded child pages", () => {
  const html = fs.readFileSync(path.join(folder, "attack.html"), "utf8");
  const doc = new JSDOM(html);
  try {
    assert.equal(doc.window.document.querySelectorAll("img").length, 0);
    assert.ok(doc.window.document.querySelector("h1").textContent.includes("<img src="));
    for (const frame of doc.window.document.querySelectorAll("iframe")) {
      const child = Buffer.from(frame.src.split(",")[1], "base64").toString("utf8");
      const data = jsonFrom(child, "nova-whiteboard-data");
      assert.ok(data.script.includes("window.PWNED=1"));
      assert.ok(!child.includes("<img "));
      assert.ok(child.includes("\\u003cimg "));
    }
  } finally { doc.window.close(); }
});

test("expanded lesson comparison retains both original brief origins rather than fabricating an unbound plan", () => {
  const html = fs.readFileSync(path.join(folder, "expanded.html"), "utf8");
  const doc = new JSDOM(html);
  try {
    const plans = [...doc.window.document.querySelectorAll("iframe")].map(frame => jsonFrom(Buffer.from(frame.src.split(",")[1], "base64").toString("utf8"), "nova-whiteboard-data").visuals);
    assert.equal(plans[0].schema, 2); assert.deepEqual(plans[0].origin, plans[1].origin);
    assert.equal(plans[0].source_fingerprint, plans[1].source_fingerprint);
    assert.equal(plans[0].steps[0].description, plans[1].steps[0].description);
    assert.notEqual(plans[0].steps[1].elements[0].x, plans[1].steps[1].elements[0].x);
  } finally { doc.window.close(); }
});
