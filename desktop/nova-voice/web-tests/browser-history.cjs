"use strict";
// Optional REAL Chromium validation of offline comparison rendering/isolation.
// Needs an existing Playwright/Chromium/Python installation; downloads nothing.
// Plans are authored diagnostics, not evidence of model comprehension/Windows QA.
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const { generate } = require("./history-fixture.cjs");
const retained = !!process.env.NOVA_BROWSER_OUTPUT;
const out = retained ? path.resolve(process.env.NOVA_BROWSER_OUTPUT) : fs.mkdtempSync(path.join(os.tmpdir(), "nova-history-browser-"));
fs.mkdirSync(out, { recursive: true });
const expected = generate(out), results = [], errors = [], requests = [], downloads = [], dialogs = [];
const checked = (name, details = {}) => results.push({ name, ...details });
async function focus(frame, title) {
  await frame.locator("#scene-title").filter({ hasText: title }).waitFor();
  await frame.locator('#whiteboard[aria-busy="false"]').waitFor();
}
const documentWidth = () => document.documentElement.scrollWidth <= innerWidth;
const drawing = frame => frame.locator("#wb-rows").evaluate(n => n.innerHTML);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.NOVA_CHROMIUM || "/tmp/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    for (const width of [360, 768, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: width < 1000 ? "reduce" : "no-preference", acceptDownloads: true });
      const p = await context.newPage();
      p.on("pageerror", e => errors.push(e.message));
      p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
      p.on("request", r => { if (/^https?:/i.test(r.url())) requests.push(r.url()); });
      p.on("download", d => downloads.push(d.suggestedFilename()));
      p.on("dialog", d => { dialogs.push(d.type()); void d.dismiss(); });
      await p.goto(pathToFileURL(path.join(out, "compare.html")).href);
      const a = p.frameLocator("#before"), b = p.frameLocator("#after");
      await focus(a, expected.source.steps[1].title); await focus(b, expected.source.steps[1].title);
      assert.equal(await p.locator("iframe").count(), 2);
      assert.ok(await p.evaluate(documentWidth));
      for (const frame of [a, b]) {
        assert.equal(await frame.locator("#whiteboard").getAttribute("data-visuals"), "validated");
        assert.equal(await frame.locator("#wb-audio").evaluate(n => n.paused && !n.src), true);
        assert.equal(await frame.locator("#nova-whiteboard-recordings").count(), 0);
        assert.ok(await frame.locator("#wb-output").isHidden());
        assert.ok(await frame.locator("#wb-customization").isHidden());
        assert.ok(await frame.locator("#wb-output-review").isChecked() === false);
        assert.ok(await frame.locator("body").evaluate(documentWidth));
        const data = JSON.parse(await frame.locator("#nova-whiteboard-data").textContent());
        assert.deepEqual(data.steps, expected.source.steps); assert.equal(data.script, expected.source.script);
      }
      assert.ok(await a.locator('[data-scene-element="0"] circle').count() === 1);
      assert.ok(await b.locator('[data-scene-element="0"] rect').count() === 1);
      assert.notEqual(await drawing(a), await drawing(b));
      checked("actual different target geometry with identical raw script/roles, paused and no authority controls", { width });
      // Full comparison screenshots expose responsive parent AND actual iframes.
      await p.screenshot({ path: path.join(out, `comparison-${width}.png`), fullPage: true });
      const isolated = await p.evaluate(() => {
        try { document.querySelector("#before").contentWindow.document.body; return false; }
        catch (e) { return e.name === "SecurityError"; }
      });
      assert.ok(isolated); checked("opaque origins prevent a parent app/browser bridge", { width });
      // Independently operate the same focus scene, never the other frame.
      await a.locator("#wb-next").click(); await focus(a, expected.source.steps[2].title);
      assert.equal(await b.locator("#scene-title").textContent(), expected.source.steps[1].title);
      await b.locator("#wb-next").click(); await focus(b, expected.source.steps[2].title);
      assert.equal(await drawing(a), await drawing(b));
      const stable = await drawing(b);
      await a.locator("#wb-play").click();
      if (width >= 1000) {
        assert.ok((await a.locator("#wb-play").textContent()).includes("إيقاف"));
        await a.locator("#wb-play").click();
      } else {
        assert.ok((await a.locator("#wb-play").textContent()).includes("إعادة تشغيل"));
      }
      assert.equal(await drawing(b), stable);
      assert.ok(await a.locator("#wb-audio").evaluate(n => n.paused && !n.src));
      checked("independent navigation/play/pause and unchanged outside-scene drawing", { width });
      for (const file of ["same.html", "focus.html", "expanded.html", "attack.html"]) {
        await p.goto(pathToFileURL(path.join(out, file)).href);
        const before = p.frameLocator("#before"), after = p.frameLocator("#after");
        await before.locator('#whiteboard[data-visuals="validated"]').waitFor();
        await after.locator('#whiteboard[data-visuals="validated"]').waitFor();
        if (file === "same.html") assert.ok((await p.locator("#changes").textContent()).includes("لا تغيير"));
        if (file === "focus.html") { await focus(before, expected.source.steps[2].title); await focus(after, expected.source.steps[2].title); }
        if (file === "expanded.html") {
          const plans = [];
          for (const f of [before, after]) plans.push(JSON.parse(await f.locator("#nova-whiteboard-data").textContent()).visuals);
          assert.equal(plans[0].schema, 2); assert.deepEqual(plans[0].origin, plans[1].origin);
        }
        if (file === "attack.html") {
          assert.equal(await p.evaluate(() => window.PWNED), undefined);
          assert.equal(await p.locator("img").count(), 0);
          assert.ok((await p.locator("h1").textContent()).includes("<img src="));
          for (const frame of [before, after]) {
            assert.equal(await frame.locator("body").evaluate(() => window.PWNED), undefined);
            assert.equal(await frame.locator("img").count(), 0);
          }
        }
        assert.ok(await p.evaluate(documentWidth), file + " " + width);
        checked(file + " actual offline rendering and valid boundaries", { width });
      }
      await context.close();
    }
    assert.deepEqual(requests, []); assert.deepEqual(errors, []); assert.deepEqual(downloads, []); assert.deepEqual(dialogs, []);
    const report = { checks: results.length, results, errors, httpRequests: requests, downloads, dialogs };
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    if (!retained) fs.rmSync(out, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
