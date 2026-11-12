"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");
const assets = path.join(__dirname, "..", "assets");
const css = fs.readFileSync(path.join(assets, "html-player.css"), "utf8");
const source = fs.readFileSync(path.join(assets, "html-player.js"), "utf8")
  .replace("__NOVA_PLAYER_CSS__", JSON.stringify(css).replace(/</g, "\\u003c"));

function animation(rate = 1, state = "running") {
  return {
    playbackRate: rate,
    playState: state,
    effect: { target: null },
    updatePlaybackRate(value) { this.playbackRate = value; },
    pause() { this.playState = "paused"; },
    play() { this.playState = "running"; },
  };
}

function mount(animations = [], supported = true) {
  const events = [];
  const timers = [];
  const dom = new JSDOM(`<!doctype html><html><body><h1 id="original">Original page</h1>
    <nova-voice-player><audio controls data-nova-voice-audio src="data:audio/wav;base64,UklGRg=="></audio>
    </nova-voice-player><script>${source}</script></body></html>`, {
    runScripts: "dangerously",
    url: "file:///example/page-with-voice.html",
    beforeParse(window) {
      if (supported) window.document.getAnimations = () => animations;
      window.setInterval = callback => { timers.push(callback); return timers.length; };
      window.clearInterval = () => {};
      window.addEventListener("nova-voice:state", event => events.push(event.detail));
    },
  });
  const window = dom.window;
  const host = window.document.querySelector("nova-voice-player");
  const root = host.shadowRoot;
  const audio = root.querySelector("audio");
  let paused = true;
  let ended = false;
  Object.defineProperties(audio, {
    paused: { configurable: true, get: () => paused },
    ended: { configurable: true, get: () => ended },
  });
  const api = {
    window, dom, root, host, audio, events, timers,
    input(selector, value) {
      const control = root.querySelector(selector);
      control.value = String(value);
      control.dispatchEvent(new window.Event("input", { bubbles: true }));
    },
    check(name, checked) {
      const control = root.querySelector(`[data-option=${name}]`);
      control.checked = checked;
      control.dispatchEvent(new window.Event("change", { bubbles: true }));
    },
    transport(event) {
      paused = event !== "play";
      ended = event === "ended";
      audio.dispatchEvent(new window.Event(event));
    },
    close() { window.close(); },
  };
  return api;
}

test("audio stays embedded, no autoplay, controls isolated from the original page", () => {
  const app = mount();
  try {
    assert.ok(app.audio.src.startsWith("data:audio/wav;base64,"));
    assert.equal(app.audio.autoplay, false);
    assert.equal(app.audio.preservesPitch, true);
    assert.equal(app.window.document.querySelector("#original").textContent, "Original page");
    assert.equal(app.window.document.querySelector("style"), null); // styles are inside Shadow DOM
    assert.equal(app.root.querySelectorAll("audio").length, 1);
  } finally { app.close(); }
});

test("half speed changes audio and supported animations without compounding the original rate", () => {
  const pageAnimation = animation(2);
  const app = mount([pageAnimation]);
  try {
    app.input("input[type=range]", 0.5);
    assert.equal(app.audio.playbackRate, 0.5);
    assert.equal(pageAnimation.playbackRate, 1);
    app.input("input[type=range]", 0.5);
    assert.equal(pageAnimation.playbackRate, 1);
    assert.equal(app.root.querySelector("output").textContent, "0.50×");
    app.root.querySelector("[data-action=reset-rate]").click();
    assert.equal(app.audio.playbackRate, 1);
    assert.equal(pageAnimation.playbackRate, 2);
  } finally { app.close(); }
});

test("unchecking animation control restores the author's original rates", () => {
  const pageAnimation = animation(1.5);
  const app = mount([pageAnimation]);
  try {
    app.input("input[type=range]", 0.75);
    assert.equal(pageAnimation.playbackRate, 1.125);
    app.check("animations", false);
    assert.equal(pageAnimation.playbackRate, 1.5);
    assert.equal(app.audio.playbackRate, 0.75);
    assert.equal(app.root.querySelector("[data-option=transport]").disabled, true);
  } finally { app.close(); }
});

test("transport linking is opt-in and never resumes an animation originally paused by its author", () => {
  const running = animation();
  const alreadyPaused = animation(1, "paused");
  const app = mount([running, alreadyPaused]);
  try {
    assert.equal(running.playState, "running"); // no surprise page pause on load
    app.check("transport", true);
    assert.equal(running.playState, "paused");
    app.transport("play");
    assert.equal(running.playState, "running");
    assert.equal(alreadyPaused.playState, "paused");
    app.transport("pause");
    assert.equal(running.playState, "paused");
    app.check("transport", false);
    assert.equal(running.playState, "running");
  } finally { app.close(); }
});

test("new animations are discovered and removed ones are released", () => {
  const first = animation(2);
  const active = [first];
  const app = mount(active);
  try {
    app.input("input[type=range]", 0.5);
    const second = animation(4);
    active.push(second);
    Object.defineProperty(app.window.document, "hidden", { configurable: true, value: false });
    app.timers[0]();
    assert.equal(second.playbackRate, 2);
    active.shift();
    app.timers[0]();
    assert.equal(first.playbackRate, 2);
    assert.equal(second.playbackRate, 2);
  } finally { app.close(); }
});

test("unsupported browsers retain audio speed control and explain the animation limitation", () => {
  const app = mount([], false);
  try {
    app.input("input[type=range]", 0.5);
    assert.equal(app.audio.playbackRate, 0.5);
    assert.match(app.root.querySelector("[data-status]").textContent, /لا يتيح/);
  } finally { app.close(); }
});

test("native rate changes are reflected in the slider and published for custom page integration", () => {
  const app = mount();
  try {
    app.audio.playbackRate = 0.8;
    app.audio.dispatchEvent(new app.window.Event("ratechange"));
    assert.equal(app.root.querySelector("input[type=range]").value, "0.8");
    assert.equal(app.events.at(-1).rate, 0.8);
    assert.equal(app.events.at(-1).playing, false);
  } finally { app.close(); }
});

test("collapse is accessible and does not stop or replace the audio", () => {
  const app = mount();
  try {
    const audio = app.audio;
    const button = app.root.querySelector("[data-action=collapse]");
    button.click();
    assert.equal(app.host.hasAttribute("data-collapsed"), true);
    assert.equal(button.getAttribute("aria-expanded"), "false");
    button.click();
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.equal(app.root.querySelector("audio"), audio);
  } finally { app.close(); }
});
