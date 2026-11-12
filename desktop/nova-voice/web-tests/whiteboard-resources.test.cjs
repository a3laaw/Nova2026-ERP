"use strict";
// DOM contracts only. Real Canvas/video and network-boundary QA are separate.
const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { mount, jsonFrom, replaceJSON, resign } = require("./scene-harness.cjs");
const root = path.resolve(__dirname, ".."), examples = path.join(root, "examples"), DATA = "nova-whiteboard-data";
const vectors = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/secondary-cases.json"), "utf8"));
const plain = v => JSON.parse(JSON.stringify(v));
function app(elements, options = {}) {
  return mount(examples, { file: "visual-scenes.html", ...options, transform: raw => {
    const d = jsonFrom(raw, DATA); d.visuals.steps[0].elements = plain(elements);
    return replaceJSON(raw, DATA, resign(d));
  } });
}
for (const [valid, cases] of [[true, vectors.valid], [false, vectors.invalid]]) for (const vector of cases) test(`shared secondary ${valid ? "accepts" : "rejects"}: ${vector.id}`, () => {
  const a = app(vector.elements);
  try {
    assert.equal(a.get("wb-play").disabled, !valid);
    a.get("wb-output-review").checked = true;
    a.get("wb-output-review").dispatchEvent(new a.window.Event("change"));
    assert.equal(a.get("wb-print").disabled, !valid);
    if (!valid) assert.equal(a.document.querySelectorAll("[data-secondary-id]").length, 0);
  } finally { a.close(); }
});
function demo(transform, options = {}) { return mount(examples, { file: "secondary-source-demo.html", transform, ...options }); }
function altered(mutation) {
  return demo(raw => { const d = jsonFrom(raw, DATA); mutation(d.visuals); return replaceJSON(raw, DATA, resign(d)); });
}
const mutations = [
  ["changed geometry", p => p.resources[0].paths[0] = "M0 0L1 1"],
  ["active markup", p => p.resources[0].paths[0] = '<script>alert(1)</script>'],
  ["infinite path numbers", p => p.resources[0].paths[0] = 'M0 0L1e999 0'],
  ["missing paths", p => delete p.resources[0].paths],
  ["empty paths", p => p.resources[0].paths = []],
  ["changed author", p => p.resources[0].credit.author = "Someone else"],
  ["missing attribution", p => delete p.resources[0].credit.attribution],
  ["missing modifications", p => delete p.resources[0].credit.changes],
  ["changed source", p => p.resources[0].credit.source = "https://untrusted.invalid"],
  ["changed licence", p => p.resources[0].credit.license = "MIT"],
  ["unknown URL field", p => p.resources[0].url = "https://untrusted.invalid/a.svg"],
  ["unused resource", p => p.steps[0].elements = []],
  ["duplicate resources", p => p.resources.push(plain(p.resources[0]))],
  ["unsorted resources", p => p.resources.reverse()],
  ["null resources", p => p.resources = null],
  ["object resources", p => p.resources = {}],
];
for (const [name, mutation] of mutations) test("resource tampering rejects even after re-signing lesson: " + name, () => {
  const a = altered(mutation);
  try {
    assert.equal(a.get("wb-play").disabled, true);
    assert.equal(a.document.querySelectorAll("[data-secondary-id]").length, 0);
  } finally { a.close(); }
});
test("embedded pinned paths and absent-resource fallback share row clocks without network or remote images", () => {
  const a = demo();
  try {
    assert.equal(a.get("wb-play").disabled, false);
    const data = jsonFrom(a.document.documentElement.outerHTML, DATA), plan = a.window.novaWhiteboardScenes.read(data);
    const svg = a.document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const v = a.window.novaWhiteboardScenes.mount(svg, plan.steps[0], 1070, 0, "resource-test");
    const bound = [{ start: 0, end: 2 }, { start: 2, end: 4 }];
    v.update(bound, 1, false);
    const magnifier = svg.querySelector('[data-secondary-id="gi-magnifying-glass"]');
    const microscope = svg.querySelector('[data-secondary-id="gi-microscope"]');
    assert.equal(magnifier.dataset.secondaryState, "embedded");
    assert.equal(magnifier.querySelector("path").getAttribute("d"), plan.resources[0].paths[0]);
    assert.equal(microscope.dataset.secondaryState, "fallback");
    assert.equal(microscope.closest("[data-scene-element]").getAttribute("opacity"), "0");
    v.update(bound, 3, false); assert.equal(microscope.closest("[data-scene-element]").getAttribute("opacity"), "1");
    const forward = svg.outerHTML; v.update(bound, 0.1, false); v.update(bound, 3, false); assert.equal(svg.outerHTML, forward);
    v.update(bound, 3, true); assert.equal(magnifier.querySelector("path").getAttribute("stroke-dasharray"), null);
    assert.equal(svg.querySelectorAll("image,use,foreignObject,script").length, 0);
    assert.equal(a.networkCalls, 0);
  } finally { a.close(); }
});
test("unvalidated direct mounting cannot resolve external paths, even after another plan was read", () => {
  const a = demo();
  try {
    const data = jsonFrom(a.document.documentElement.outerHTML, DATA); a.window.novaWhiteboardScenes.read(data);
    const step = plain(data.visuals.steps[0]), svg = a.document.createElementNS("http://www.w3.org/2000/svg", "svg");
    a.window.novaWhiteboardScenes.mount(svg, step, 1070, 0, "not-read").update([{ start: 0, end: 1 }, { start: 1, end: 2 }], 2, false);
    assert.equal(svg.querySelector('[data-secondary-id="gi-magnifying-glass"]').dataset.secondaryState, "fallback");
  } finally { a.close(); }
});
test("source, licence, author and modifications survive printed whole lesson and scoped video credit cards", () => {
  const a = demo();
  try {
    a.get("wb-output-review").checked = true; a.get("wb-output-review").dispatchEvent(new a.window.Event("change"));
    a.get("wb-print-preview").click();
    const section = a.document.querySelector(".print-resource-credits"); assert.ok(section);
    assert.equal(section.querySelectorAll("[data-resource-credit]").length, 2);
    const data = jsonFrom(a.document.documentElement.outerHTML, DATA), plan = a.window.novaWhiteboardScenes.read(data);
    assert.deepEqual(plain(a.window.novaSecondaryAssets.creditsFor(plan, [0])).map(c => c.id), ["gi-magnifying-glass"]);
    assert.deepEqual(plain(a.window.novaSecondaryAssets.creditsFor(plan, [1])).map(c => c.id), ["gi-open-book"]);
    const credits = plain(a.window.novaSecondaryAssets.creditsFor(plan));
    for (const [i, c] of credits.entries()) {
      const card = a.window.novaWhiteboardOutput.creditCard(c, i, credits.length, { font: "", measureText: value => ({ width: Array.from(value).length * 12 }) });
      assert.equal(card.getAttribute("data-movie-credit"), c.id);
      for (const key of ["title", "attribution", "source", "license", "license_url", "changes"]) {
        assert.ok(section.textContent.includes(c[key]), key);
        assert.ok(a.get("wb-secondary-credits").textContent.includes(c[key]), key);
        assert.ok(card.textContent.includes(c[key]), key);
      }
      assert.equal(card.querySelectorAll("image,use,foreignObject,script").length, 0);
    }
  } finally { a.close(); }
});
test("only local original fallbacks need no external artwork credits or end cards", () => {
  const a = altered(p => delete p.resources);
  try {
    assert.equal(a.get("wb-play").disabled, false);
    const p = jsonFrom(a.document.documentElement.outerHTML, DATA).visuals;
    assert.deepEqual(plain(a.window.novaSecondaryAssets.creditsFor(p)), []);
    a.get("wb-output-review").checked = true; a.get("wb-output-review").dispatchEvent(new a.window.Event("change")); a.get("wb-print-preview").click();
    assert.equal(a.document.querySelector(".print-resource-credits"), null);
  } finally { a.close(); }
});
test("customized offline download retains exact resources, credits and review resets on reopen", () => {
  const a = demo(undefined, { captureDownloads: true });
  try {
    a.get("wb-save-customized").click();
    assert.equal(a.downloads.length, 1);
    const saved = a.downloads[0], original = jsonFrom(a.document.documentElement.outerHTML, DATA);
    assert.deepEqual(jsonFrom(saved, DATA), original);
    const b = demo(() => saved);
    try { assert.equal(b.get("wb-output-review").checked, false); assert.ok(b.get("wb-secondary-credits")); assert.equal(b.get("wb-play").disabled, false); } finally { b.close(); }
  } finally { a.close(); }
});
const catalogue = JSON.parse(fs.readFileSync(path.join(root, "assets/secondary-catalog.json"), "utf8"));
for (const entry of catalogue.entries) test("every audited raw drawing has identical Python/JS canonical hash: " + entry.id, () => {
  const rawSVG = fs.readFileSync(path.join(root, "tests/fixtures/secondary-raw", entry.upstream_path), "utf8");
  const d = rawSVG.match(/<path fill="#fff" d="([^"]+)"\s*\/>/)[1];
  const a = demo(raw => {
    const data = jsonFrom(raw, DATA);
    const e = plain(vectors.valid[0].elements[0]); e.asset_id = entry.id;
    data.visuals.steps[0].elements = [e]; data.visuals.steps[1].elements = [];
    data.visuals.resources = [{ id: entry.id, paths: [d], credit: entry.credit }];
    return replaceJSON(raw, DATA, resign(data));
  });
  try { assert.equal(a.get("wb-play").disabled, false); } finally { a.close(); }
});
