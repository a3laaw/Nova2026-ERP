"use strict";
// Explicitly stubbed media/geometry. This is not browser decoding or an audition.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs"), path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
function jsonFrom(html, id) {
  return JSON.parse(html.match(new RegExp('<script id="' + id + '" type="application/json">(.*?)</script>', "s"))[1]);
}
function replaceJSON(html, id, data) {
  return html.replace(new RegExp('(<script id="' + id + '" type="application/json">).*?(</script>)', "s"),
    (_, start, end) => start + JSON.stringify(data).replace(/</g, "\\u003c").replace(/&/g, "\\u0026") + end);
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => canonical(key) + ":" + canonical(value[key])).join(",") + "}";
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
}
function resign(data) {
  const payload = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "fingerprint"));
  data.fingerprint = crypto.createHash("sha256").update(canonical(payload), "ascii").digest("hex");
  return data;
}

function mount(folder, options = {}) {
  const callbacks = new Map(), errors = [], downloads = [];
  let id = 0, networkCalls = 0;
  const media = new WeakMap();
  const state = element => {
    if (!media.has(element)) media.set(element, { paused: true, ended: false, time: 0, duration: 12.7, rate: 1 });
    return media.get(element);
  };
  let html = fs.readFileSync(path.join(folder, options.file || "timed.wav.html"), "utf8");
  if (options.transform) html = options.transform(html);
  const console = new VirtualConsole();
  console.on("jsdomError", error => errors.push(error));
  const dom = new JSDOM(html, {
    runScripts: "dangerously", url: "file:///measured-lesson.html", pretendToBeVisual: true, virtualConsole: console,
    beforeParse(window) {
      if (options.captureDownloads) {
        const OriginalBlob = window.Blob;
        window.Blob = class extends OriginalBlob {
          constructor(parts, configuration) { super(parts, configuration); this.parts = parts; }
        };
        window.URL.createObjectURL = blob => { downloads.push(blob.parts.join("")); return "blob:nova-timing-test"; };
        window.URL.revokeObjectURL = () => {};
        window.HTMLAnchorElement.prototype.click = function () {};
      }
      if (options.width) window.innerWidth = options.width;
      window.matchMedia = () => ({ matches: !!options.reducedMotion });
      window.fetch = () => { networkCalls++; throw new Error("No network allowed"); };
      window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
      window.cancelAnimationFrame = key => callbacks.delete(key);
      const prototype = window.HTMLMediaElement.prototype;
      Object.defineProperties(prototype, {
        paused: { configurable: true, get() { return state(this).paused; } },
        ended: { configurable: true, get() { return state(this).ended; } },
        duration: { configurable: true, get() { return state(this).duration; } },
        currentTime: { configurable: true, get() { return state(this).time; }, set(value) { state(this).time = Number(value); state(this).ended = false; } },
        src: { configurable: true, get() { return this.getAttribute("src") || ""; }, set(value) { this.setAttribute("src", value); state(this).time = 0; state(this).ended = false; } },
        playbackRate: { configurable: true, get() { return state(this).rate; }, set(value) {
          const previous = state(this).rate;
          state(this).rate = Number(value);
          if (previous !== Number(value)) this.dispatchEvent(new window.Event("ratechange"));
        } },
      });
      prototype.play = function () { state(this).paused = false; state(this).ended = false; this.dispatchEvent(new window.Event("play")); return Promise.resolve(); };
      prototype.pause = function () { state(this).paused = true; this.dispatchEvent(new window.Event("pause")); };
      if (options.beforeParse) options.beforeParse(window);
    },
  });
  const window = dom.window, document = window.document;
  const audio = document.getElementById("wb-audio");
  return {
    window, document, audio, errors, downloads,
    get(id) { return document.getElementById(id); },
    get mode() { return document.getElementById("whiteboard").dataset.timing; },
    get networkCalls() { return networkCalls; },
    get frames() { return callbacks.size; },
    finishErase() { this.advance(0); this.advance(560); },
    set duration(value) { state(audio).duration = value; },
    position(time, event = "timeupdate") { audio.currentTime = time; audio.dispatchEvent(new window.Event(event)); },
    advance(time) { const pending = Array.from(callbacks.values()); callbacks.clear(); pending.forEach(callback => callback(time)); },
    finish() { state(audio).time = state(audio).duration; state(audio).paused = true; state(audio).ended = true; audio.dispatchEvent(new window.Event("ended")); },
    pieces(row) {
      return Array.from(document.querySelectorAll('#wb-rows text[data-row="' + row + '"]'), text => {
        const clip = text.getAttribute("clip-path").slice(5, -1);
        const rect = document.getElementById(clip).firstElementChild;
        return { part: Number(rect.getAttribute("width")) / (Array.from(text.textContent).length * 18 + 12), weight: Math.max(500, Array.from(text.textContent).length * 65) };
      });
    },
    row(row) { const pieces = this.pieces(row); return pieces.reduce((sum, piece) => sum + piece.part * piece.weight, 0) / pieces.reduce((sum, piece) => sum + piece.weight, 0); },
    close() {
      window.dispatchEvent(new window.Event("pagehide")); window.close();
      assert.equal(networkCalls, 0);
      assert.deepEqual(errors.map(error => error.message), []);
    },
  };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

module.exports = { mount, jsonFrom, replaceJSON, resign };
