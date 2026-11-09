"use strict";
// Authored science fixture. Media/geometry are stubbed here, not live AI or layout.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { mount, jsonFrom } = require("./scene-harness.cjs");
const examples = path.resolve(__dirname, "../examples");
const file = "water-cycle-whiteboard.html";
const DATA = "nova-whiteboard-data";
const source = jsonFrom(fs.readFileSync(path.join(examples, file), "utf8"), DATA);
const plan = source.visuals.steps[0];
const weights = source.steps[0].rows.map(row => Math.max(1000, Array.from(row.text).length * 65));
const bounds = weights.reduce((all, weight, row) => [...all, (all[row - 1] || 0) + weight], []);
const opacity = (app, row) => plan.elements.map((element, index) => element.row === row
  ? app.document.querySelector(`[data-scene-element="${index}"]`).getAttribute("opacity") : null).filter(Boolean);
function create(options = {}) { return mount(examples, { file, ...options }); }

for (const width of [360, 768, 1366]) test(`science cues follow four source rows, not one simultaneous picture, DOM width ${width}`, () => {
  const app = create({ width });
  try {
    assert.equal(app.get("whiteboard").dataset.visuals, "validated");
    assert.ok(app.document.title.includes("ليس ناتج خدمة AI"));
    assert.equal(app.mode, "silent");
    assert.ok(opacity(app, 0).every(value => value === "1"));
    for (const row of [1, 2, 3]) assert.ok(opacity(app, row).every(value => value === "0"));
    app.get("wb-play").click(); app.advance(0);
    for (let row = 1; row < 4; row++) {
      app.advance(bounds[row - 1] + 1);
      for (let shown = 0; shown <= row; shown++) assert.ok(opacity(app, shown).every(value => value === "1"));
      for (let hidden = row + 1; hidden < 4; hidden++) assert.ok(opacity(app, hidden).every(value => value === "0"));
    }
    app.advance(bounds[3] + 1);
    assert.equal(app.get("position-label").textContent, "100%");
    assert.equal(app.document.querySelectorAll('[data-icon="drop"]').length, 3);
  } finally { app.close(); }
});

test("science silent playback pauses without revealing later phases and restart resets them", () => {
  const app = create();
  try {
    app.get("wb-play").click(); app.advance(0); app.advance(bounds[0] + 1);
    app.get("wb-play").click();
    const state = app.get("wb-rows").outerHTML;
    app.advance(bounds[3] + 10000);
    assert.equal(app.get("wb-rows").outerHTML, state);
    assert.ok(opacity(app, 2).every(value => value === "0"));
    app.get("wb-restart").click();
    assert.ok(opacity(app, 0).every(value => value === "1"));
    for (const row of [1, 2, 3]) assert.ok(opacity(app, row).every(value => value === "0"));
  } finally { app.close(); }
});

test("customized science download keeps the source, fixture disclosure and exact plan", () => {
  const app = create({ captureDownloads: true });
  try {
    app.get("wb-play").click(); app.advance(0); app.advance(bounds[3] + 1);
    app.get("wb-save-customized").click();
    assert.equal(app.downloads.length, 1);
    const saved = jsonFrom(app.downloads[0], DATA);
    assert.deepEqual(saved, source);
    assert.equal(saved.visuals.steps[0].elements.length, 17);
    assert.ok(saved.visuals.notes[0].includes("ليست استجابة من خدمة AI"));
  } finally { app.close(); }
});
