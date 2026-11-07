"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");

test("a real Python-exported HTML file mounts the controller with the exact embedded WAV", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "nova-html-dom-"));
  let dom;
  try {
    const python = process.env.NOVA_VOICE_PYTHON || "python";
    execFileSync(python, ["-c", `
from pathlib import Path
import sys, wave
from nova_voice.html_export import HtmlPage, embed_audio
root = Path(sys.argv[1])
page = root / 'original.html'
page.write_text('<!doctype html><html><body><h1>Original page</h1></body></html>', encoding='utf-8')
audio = root / 'speech.wav'
with wave.open(str(audio), 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(22050)
    wav.writeframes(bytes(4410))
embed_audio(HtmlPage.load(page), audio, root / 'result.html')
`, folder], { cwd: path.join(__dirname, ".."), stdio: "pipe" });
    const html = fs.readFileSync(path.join(folder, "result.html"), "utf8");
    dom = new JSDOM(html, { runScripts: "dangerously", url: "file:///example/result.html" });
    const host = dom.window.document.querySelector("nova-voice-player");
    assert.ok(host.shadowRoot);
    const audio = host.shadowRoot.querySelector("audio");
    const payload = audio.src.split(",")[1];
    assert.deepEqual(Buffer.from(payload, "base64"), fs.readFileSync(path.join(folder, "speech.wav")));
    assert.equal(host.style.getPropertyPriority("position"), "important");
    assert.equal(dom.window.document.querySelector("h1").textContent, "Original page");
    assert.equal(audio.autoplay, false);
    const slider = host.shadowRoot.querySelector("input[type=range]");
    slider.value = "0.5";
    slider.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(audio.playbackRate, 0.5);
  } finally {
    if (dom) dom.window.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
