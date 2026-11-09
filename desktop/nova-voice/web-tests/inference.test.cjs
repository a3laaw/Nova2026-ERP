'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'INFERENCE-GUIDE-AR.html'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'assets/inference-catalog.json'), 'utf8'));
const python = process.env.NOVA_VOICE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const vectors = JSON.parse(execFileSync(python, [path.join(__dirname, 'inference-fixture.py')], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));

async function page(t, settings = {}) {
  const calls = { copy: [], blobs: [], downloads: [], revoke: [], network: [], storage: [], errors: [], confirms: 0 };
  const console = new VirtualConsole();
  console.on('jsdomError', (error) => calls.errors.push(String(error)));
  const dom = new JSDOM(settings.html || html, {
    url: settings.url || 'https://guide.example/inference', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: console,
    beforeParse(w) {
      const prohibited = (name) => () => { calls.network.push(name); throw new Error('No network/media: ' + name); };
      w.fetch = prohibited('fetch');
      w.XMLHttpRequest = prohibited('xhr');
      w.WebSocket = prohibited('socket');
      w.Audio = prohibited('audio');
      w.navigator.sendBeacon = prohibited('beacon');
      for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(w, key, { get() { calls.storage.push(key); throw new Error('No persistence'); } });
      Object.defineProperty(w.navigator, 'clipboard', { value: settings.clipboard === false ? undefined : { async writeText(text) { calls.copy.push(text); } } });
      w.confirm = () => { calls.confirms += 1; return settings.confirm !== false; };
      w.Blob = Blob;
      w.URL.createObjectURL = (blob) => { calls.blobs.push(blob); return 'blob:guide-' + calls.blobs.length; };
      w.URL.revokeObjectURL = (url) => calls.revoke.push(url);
      w.HTMLAnchorElement.prototype.click = function () { calls.downloads.push({ name: this.download, href: this.href }); };
    },
  });
  t.after(() => dom.window.close());
  if (dom.window.document.readyState !== 'complete') await new Promise((resolve) => dom.window.addEventListener('load', resolve, { once: true }));
  return { w: dom.window, d: dom.window.document, calls };
}
function input(w, id, value) {
  const node = w.document.getElementById(id);
  node.value = value;
  node.dispatchEvent(new w.Event('input', { bubbles: true }));
}
function policy(w, value) {
  w.document.getElementById('policy').value = value;
  w.document.getElementById('policy').dispatchEvent(new w.Event('change', { bubbles: true }));
}
function choose(w, id) {
  const d = w.document;
  d.querySelector('[data-mode="all"]').click();
  d.querySelector('[data-category="all"]').click();
  input(w, 'search', '');
  const node = [...d.querySelectorAll('[data-capability]')].find((button) => button.dataset.capability === id);
  assert.ok(node, 'capability is in owned catalog: ' + id);
  node.click();
}
const microtask = () => new Promise((resolve) => setImmediate(resolve));

test('guide opens silent and empty, with all sections and no network or persistence', async (t) => {
  const { d, calls } = await page(t);
  assert.equal(d.documentElement.dir, 'rtl');
  assert.equal(d.getElementById('total-count').textContent, String(catalog.entries.length));
  assert.equal(d.querySelectorAll('[data-capability]').length, catalog.entries.length);
  assert.equal(d.querySelectorAll('[data-category]').length, 9);
  assert.equal(d.getElementById('source').value, '');
  assert.equal(d.getElementById('output').value, '');
  assert.ok(d.getElementById('copy').disabled && d.getElementById('download').disabled);
  assert.deepEqual(calls.network, []);
  assert.deepEqual(calls.storage, []);
  assert.deepEqual(calls.copy, []);
  assert.deepEqual(calls.downloads, []);
  assert.deepEqual(calls.errors, []);
});

test('every Python content/local/sacred/error/Unicode prompt vector is byte-equivalent in JS', async (t) => {
  const { w } = await page(t);
  for (const vector of vectors.cases) {
    if (vector.error) assert.throws(() => w.NovaInference.buildPrompt(vector.id, vector.fields, vector.policy), { message: vector.error }, vector.id);
    else assert.equal(w.NovaInference.buildPrompt(vector.id, vector.fields, vector.policy), vector.expected, vector.id);
  }
});

test('every drawing addendum and sacred refusal matches Python, without fake bound plans', async (t) => {
  const { w } = await page(t);
  for (const vector of vectors.drawings) {
    if (vector.error) assert.throws(() => w.NovaInference.buildDrawing(vector.id, vector.policy), { message: vector.error }, vector.id);
    else assert.equal(w.NovaInference.buildDrawing(vector.id, vector.policy), vector.expected, vector.id);
  }
});

test('search conformance includes Arabic diacritics, English names and combined filters', async (t) => {
  const { w } = await page(t);
  for (const vector of vectors.searches) assert.deepEqual(Array.from(w.NovaInference.search(vector.query, vector.category, vector.mode), (e) => e.id), vector.expected);
});

test('all 67 detail cards render owned steps, destinations, limits and compatible examples', async (t) => {
  const { w, d, calls } = await page(t);
  for (const entry of catalog.entries) {
    choose(w, entry.id);
    assert.equal(d.getElementById('capability-title').textContent, entry.title);
    assert.equal(d.getElementById('destination').textContent, catalog.targets[entry.target]);
    assert.equal(d.getElementById('usage-steps').children.length, entry.steps.length);
    assert.equal(d.getElementById('entry-limits').children.length, entry.limits.length);
    assert.equal(d.getElementById('example-output').textContent, entry.example.output);
    assert.equal(d.getElementById('element-panel').hidden, entry.element === null);
    assert.equal(d.getElementById('drawing-section').hidden, !entry.drawing);
  }
  assert.deepEqual(calls.errors, []);
  assert.deepEqual(calls.network, []);
});

test('authored source and building never automatically copy, download or adopt anything', async (t) => {
  const { w, d, calls } = await page(t);
  d.getElementById('load-example').click();
  assert.equal(d.getElementById('source').value, catalog.entries[0].example.source);
  d.getElementById('build').click();
  assert.ok(d.getElementById('output').value.includes('أمانة المصدر'));
  assert.equal(d.getElementById('copy').disabled, false);
  assert.equal(d.getElementById('download').disabled, false);
  assert.deepEqual(calls.copy, []);
  assert.deepEqual(calls.downloads, []);
  assert.deepEqual(calls.network, []);
  assert.equal(w.document.querySelectorAll('audio,video,iframe').length, 0);
});

test('empty and oversized source reject without truncation or field echo', async (t) => {
  const { w, d } = await page(t);
  d.getElementById('build').click();
  assert.equal(d.getElementById('status').dataset.error, 'true');
  assert.equal(d.getElementById('output').value, '');
  input(w, 'source', 'ن'.repeat(12001));
  d.getElementById('build').click();
  assert.equal(d.getElementById('source').value.length, 12001);
  assert.match(d.getElementById('status').textContent, /12000/);
  assert.equal(d.getElementById('copy').disabled, true);
});

test('changing any field or capability invalidates generated text and does not rewrite source', async (t) => {
  const { w, d } = await page(t);
  input(w, 'source', 'مصدر خاص للمراجعة.');
  for (const id of ['subject', 'grade', 'lesson-title', 'notes', 'source']) {
    d.getElementById('build').click();
    assert.ok(d.getElementById('output').value);
    input(w, id, id === 'source' ? 'مصدر خاص للمراجعة.' : 'تعديل');
    assert.equal(d.getElementById('output').value, '');
    assert.ok(d.getElementById('copy').disabled && d.getElementById('download').disabled);
  }
  d.getElementById('build').click();
  choose(w, 'motion-path');
  assert.equal(d.getElementById('output').value, '');
  assert.equal(d.getElementById('source').value, 'مصدر خاص للمراجعة.');
});

test('local settings copy instructions only, ignoring retained private source and notes', async (t) => {
  const { w, d, calls } = await page(t);
  input(w, 'source', 'PRIVATE-source');
  input(w, 'notes', 'PRIVATE-note');
  choose(w, 'role-colors');
  assert.ok(d.getElementById('content-fields').hidden);
  d.getElementById('build').click();
  assert.ok(d.getElementById('output').value.includes('خطوات محلية فقط'));
  assert.ok(!d.getElementById('output').value.includes('PRIVATE'));
  d.getElementById('copy').click();
  await microtask();
  assert.equal(calls.copy.length, 1);
  assert.ok(!calls.copy[0].includes('PRIVATE'));
});

test('sacred policy clears prior prompt, hides external preparation and excludes all supplied fields', async (t) => {
  const { w, d, calls } = await page(t);
  choose(w, 'motion-rotate');
  for (const id of ['source', 'notes', 'subject', 'grade', 'lesson-title']) input(w, id, 'PRIVATE-' + id);
  d.getElementById('build').click();
  policy(w, 'sacred');
  assert.equal(d.getElementById('output').value, '');
  assert.ok(d.getElementById('copy').disabled);
  assert.ok(d.getElementById('content-fields').hidden && d.getElementById('drawing-section').hidden);
  assert.ok(d.getElementById('normal-detail').hidden);
  d.getElementById('build').click();
  assert.equal(d.getElementById('output').value, catalog.shared.sacred);
  d.getElementById('copy').click();
  await microtask();
  assert.deepEqual(calls.copy, [catalog.shared.sacred]);
  assert.ok(!calls.copy[0].includes('PRIVATE'));
  policy(w, 'general');
  assert.equal(d.getElementById('output').value, '');
  assert.equal(d.getElementById('source').value, 'PRIVATE-source');
});

test('forced hidden drawing action and stale copy cannot bypass sacred policy', async (t) => {
  const { w, d, calls } = await page(t);
  choose(w, 'motion-path');
  input(w, 'source', 'مصدر مؤلف.');
  d.getElementById('build').click();
  // Even without an input/change event, fresh-output verification sees the policy.
  d.getElementById('policy').value = 'sacred';
  d.getElementById('copy').click();
  d.getElementById('copy-drawing').click();
  await microtask();
  assert.deepEqual(calls.copy, []);
  assert.match(d.getElementById('drawing-status').textContent, /غير متاحة/);
  assert.match(d.getElementById('status').textContent, /أعد البناء/);
});

test('manual DOM field mutation also requires rebuilding before copy and download', async (t) => {
  const { w, d, calls } = await page(t);
  input(w, 'source', 'المصدر الأول.');
  d.getElementById('build').click();
  d.getElementById('source').value = 'مصدر مختلف دون حدث input.';
  d.getElementById('copy').click();
  d.getElementById('download').click();
  await microtask();
  assert.deepEqual(calls.copy, []);
  assert.deepEqual(calls.downloads, []);
});

test('script-like pasted text remains literal data in textareas and never creates DOM nodes', async (t) => {
  const { w, d } = await page(t);
  const attack = 'مصدر </textarea><script>window.BAD=1</script><img src=x onerror="window.BAD=2">';
  input(w, 'source', attack);
  input(w, 'notes', attack);
  d.getElementById('build').click();
  assert.equal(w.BAD, undefined);
  assert.equal(d.querySelectorAll('img').length, 0);
  assert.equal(d.querySelectorAll('script').length, 2);
  assert.ok(d.getElementById('output').value.includes('window.BAD=1'));
});

test('owned catalog text is rendered with textContent, including script-like example labels', async (t) => {
  const modified = JSON.parse(JSON.stringify(catalog));
  const attack = '</script><img id="bad-image" src=x onerror="window.BAD=1">';
  modified.entries[0].title = attack;
  modified.entries[0].example.output = attack;
  const payload = JSON.stringify(modified).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const altered = html.replace(/(<script id="inference-data" type="application\/json">)[\s\S]*?(<\/script>)/, (_, before, after) => before + payload + after);
  const { w, d } = await page(t, { html: altered });
  assert.equal(d.getElementById('capability-title').textContent, attack);
  assert.equal(d.getElementById('example-output').textContent, attack);
  assert.equal(d.getElementById('bad-image'), null);
  assert.equal(w.BAD, undefined);
});

test('drawing copy is an explicit separate addendum, never mixed into narration preparation', async (t) => {
  const { w, d, calls } = await page(t);
  choose(w, 'shape-circle');
  input(w, 'source', 'مصدر الدائرة.');
  d.getElementById('build').click();
  assert.ok(!d.getElementById('output').value.includes('"kind": "circle"'));
  d.getElementById('copy-drawing').click();
  await microtask();
  assert.equal(calls.copy.length, 1);
  assert.equal(calls.copy[0], w.NovaInference.buildDrawing('shape-circle'));
  assert.ok(calls.copy[0].includes('ليس JSON جاهزًا للاستيراد'));
});

test('clipboard-unavailable fallback selects literal text without automatic command execution', async (t) => {
  const { w, d, calls } = await page(t, { clipboard: false });
  input(w, 'source', 'مصدر مؤلف.');
  d.getElementById('build').click();
  d.getElementById('copy').click();
  await microtask();
  const output = d.getElementById('output');
  assert.equal(output.selectionStart, 0);
  assert.equal(output.selectionEnd, output.value.length);
  assert.match(d.getElementById('status').textContent, /Ctrl\+C/);
  assert.deepEqual(calls.copy, []);
});

test('explicit TXT download uses a bounded owned filename, plain text and revokes its URL', async (t) => {
  const { w, d, calls } = await page(t);
  input(w, 'source', 'مصدر مؤلف.');
  input(w, 'lesson-title', '../../private/unsafe');
  d.getElementById('build').click();
  d.getElementById('download').click();
  assert.equal(calls.downloads.length, 1);
  assert.equal(calls.downloads[0].name, 'NovaVoice-Istidlal-pdf-text.txt');
  assert.equal(await calls.blobs[0].text(), d.getElementById('output').value);
  assert.equal(calls.blobs[0].type, 'text/plain;charset=utf-8');
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.deepEqual(calls.revoke, ['blob:guide-1']);
});

test('sacred TXT download contains only local review instructions', async (t) => {
  const { w, d, calls } = await page(t);
  input(w, 'source', 'PRIVATE-source');
  policy(w, 'sacred');
  d.getElementById('build').click();
  d.getElementById('download').click();
  assert.equal(calls.downloads[0].name, 'NovaVoice-Istidlal-local-review.txt');
  assert.equal(await calls.blobs[0].text(), catalog.shared.sacred);
});

test('authored example replacement requires confirmation and affects only the source', async (t) => {
  const { w, d, calls } = await page(t, { confirm: false });
  input(w, 'source', 'مصدري الذي لا أريد استبداله.');
  input(w, 'subject', 'مادتي');
  d.getElementById('load-example').click();
  assert.equal(calls.confirms, 1);
  assert.equal(d.getElementById('source').value, 'مصدري الذي لا أريد استبداله.');
  assert.equal(d.getElementById('subject').value, 'مادتي');
  assert.equal(d.getElementById('output').value, '');
});

test('filters and no-results state are recoverable and preserve pasted source', async (t) => {
  const { w, d } = await page(t);
  input(w, 'source', 'مصدر باقٍ.');
  d.querySelector('[data-category="motion"]').click();
  assert.ok(d.querySelectorAll('[data-capability]').length > 5);
  d.querySelector('[data-mode="local"]').click();
  assert.equal(d.querySelectorAll('[data-capability]').length, 3);
  input(w, 'search', 'nonexistent-xz');
  assert.equal(d.getElementById('empty-results').hidden, false);
  assert.equal(d.getElementById('builder').hidden, true);
  choose(w, 'whiteboard');
  assert.equal(d.getElementById('builder').hidden, false);
  assert.equal(d.getElementById('source').value, 'مصدر باقٍ.');
});

test('deep links select an owned capability on file:// and reject arbitrary malformed fragments', async (t) => {
  const first = await page(t, { url: 'file:///tmp/INFERENCE-GUIDE-AR.html#motion-rotate' });
  assert.equal(first.d.getElementById('capability-title').textContent, catalog.entries.find((e) => e.id === 'motion-rotate').title);
  const second = await page(t, { url: 'file:///tmp/INFERENCE-GUIDE-AR.html#%E0%A4%A' });
  assert.equal(second.d.getElementById('capability-title').textContent, catalog.entries[0].title);
  assert.deepEqual(first.calls.errors, []);
  assert.deepEqual(second.calls.errors, []);
});

test('guide controller contains no request, storage, HTML execution or speech API', () => {
  const js = fs.readFileSync(path.join(root, 'assets/inference.js'), 'utf8');
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|serviceWorker|speechSynthesis|innerHTML|insertAdjacentHTML|\beval\s*\(|new Function/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<iframe|<audio|<video/i);
});
