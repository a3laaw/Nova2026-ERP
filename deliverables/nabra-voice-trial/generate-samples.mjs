// SPDX-License-Identifier: GPL-3.0-or-later
// Offline diagnostic driver only. It does not modify or integrate Nova Voice.
// Requires the separately obtained/built, pinned Oddadmix/nabra-tts source.
// Usage: node generate-samples.mjs UPSTREAM_BUILT_DIRECTORY MODELS_DIRECTORY [OUTPUT_DIRECTORY]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const [upstreamArgument, modelsArgument, outputArgument] = process.argv.slice(2);
if (!upstreamArgument || !modelsArgument) {
  throw new Error('Usage: node generate-samples.mjs UPSTREAM_BUILT_DIRECTORY MODELS_DIRECTORY [OUTPUT_DIRECTORY]');
}
const upstream = resolve(upstreamArgument);
const models = resolve(modelsArgument);
const output = resolve(outputArgument ?? HERE);
const PIN = '16b5281ce61993df3526740990cf845a3f3036f4';
const EXPECTED = {
  'model.onnx': '08c1df048f2decbff3f86dc8e625e10ff3c8d5f66dfc97881c6974272f41ca5e',
  'af_msa.bin': '129d447a7c9bdce1d5b6cb5ecb789bbfd9f427b7775131a97dfa5638583b3b92',
};
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const modelBytes = await readFile(join(models, 'model.onnx'));
const voiceBytes = await readFile(join(models, 'af_msa.bin'));
assert.equal(sha256(modelBytes), EXPECTED['model.onnx'], 'Different model: review provenance and expected hashes first.');
assert.equal(sha256(voiceBytes), EXPECTED['af_msa.bin'], 'Different voice: review provenance and expected hashes first.');
assert.equal(voiceBytes.length, 510 * 256 * 4);
const sourcePackage = JSON.parse(await readFile(join(upstream, 'package.json'), 'utf8'));
const requireUpstream = createRequire(join(upstream, 'package.json'));
const ortDirectory = dirname(requireUpstream.resolve('onnxruntime-web'));
const ortPackage = JSON.parse(await readFile(join(ortDirectory, '..', 'package.json'), 'utf8'));
assert.equal(sourcePackage.name, 'nabra-tts');
assert.equal(sourcePackage.version, '0.1.0');
assert.equal(ortPackage.version, '1.30.0');
const samples = JSON.parse(await readFile(join(HERE, 'samples.json'), 'utf8'));
assert.equal(samples.length, 3);
const stripMarks = (text) => text.replace(/\p{M}/gu, '');
assert.equal(stripMarks(samples[0].text), stripMarks(samples[1].text), 'The A/B samples must differ only in marks.');
for (const sample of samples) {
  assert.match(sample.file, /^[A-Za-z-]+\.wav$/);
  assert.ok(sample.text.trim().length > 0);
  assert.ok(Array.from(stripMarks(sample.text)).length < 400, 'Use short diagnostic text, never a long lesson.');
}
await mkdir(output, { recursive: true });

// Do not fetch a model, CDN, diacritizer or any other remote resource.
const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (resource, options) => {
  const value = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url;
  const scheme = new URL(value).protocol;
  assert.ok(scheme === 'blob:' || scheme === 'data:', `Network disabled for synthesis: ${scheme}`);
  requests.push(scheme);
  return originalFetch(resource, options);
};
const modelUrl = URL.createObjectURL(new Blob([modelBytes]));
const voiceUrl = URL.createObjectURL(new Blob([voiceBytes]));
let tts;
try {
  const { NabraTTS } = await import(pathToFileURL(join(upstream, 'dist/index.js')).href);
  const loadStart = performance.now();
  tts = await NabraTTS.load({
    worker: false,
    device: 'wasm',
    dtype: 'fp32',
    cache: false,
    normalize: false,
    numThreads: 1,
    modelUrl,
    voiceUrl,
    wasmPaths: pathToFileURL(ortDirectory + '/').href,
  });
  const report = {
    schema: 1,
    modelSource: 'User-provided files, downloaded from the connected Drive; hashes identify these exact bytes, not independent upstream authenticity.',
    upstream: { repository: 'https://github.com/Oddadmix/nabra-tts', sourceCommit: PIN, packageVersion: sourcePackage.version, onnxruntimeWeb: ortPackage.version },
    model: { file: 'model.onnx', bytes: modelBytes.length, sha256: sha256(modelBytes) },
    voice: { file: 'af_msa.bin', bytes: voiceBytes.length, shape: [510, 256], sha256: sha256(voiceBytes) },
    runtime: { platform: process.platform, architecture: process.arch, node: process.version, backend: tts.device, threads: 1, modelLoadMs: Math.round(performance.now() - loadStart) },
    settings: { speed: 1, normalize: false, automaticDiacritizer: false, postprocessing: 'none; upstream WAV encoder only', format: 'PCM signed 16-bit little-endian, 24000 Hz, mono' },
    validation: { actualModelInference: true, externalFetches: 0, windowsTested: false, fourGbTested: false, humanPronunciationReview: false, qualityVersusKareemEstablished: false, novaVoiceIntegration: false },
    clips: [],
  };
  assert.equal(tts.device, 'wasm');
  for (const sample of samples) {
    const phonemes = await tts.phonemize(sample.text);
    assert.ok(phonemes.length > 0);
    const phonemeLengths = phonemes.map((p) => Array.from(p).length);
    assert.ok(phonemeLengths.every((n) => n > 0 && n < 510), 'Possible phoneme truncation: shorten the sample.');
    const start = performance.now();
    const { audio, sampleRate } = await tts.generate(sample.text, { speed: 1 });
    const generationMs = Math.round(performance.now() - start);
    assert.equal(sampleRate, 24000);
    assert.ok(audio instanceof Float32Array && audio.length > 0 && audio.every(Number.isFinite));
    let peak = 0, energy = 0, clippedSamples = 0;
    for (const x of audio) {
      peak = Math.max(peak, Math.abs(x));
      energy += x * x;
      if (Math.abs(x) > 1) clippedSamples++;
    }
    assert.ok(peak > 1e-6, 'Silent output');
    const wav = Buffer.from(await tts.toWav(audio).arrayBuffer());
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.length, 44 + audio.length * 2);
    await writeFile(join(output, sample.file), wav);
    const clip = {
      ...sample,
      bytes: wav.length,
      sha256: sha256(wav),
      sampleRate,
      channels: 1,
      sampleFrames: audio.length,
      seconds: audio.length / sampleRate,
      generationMs,
      peak: Number(peak.toFixed(8)),
      rms: Number(Math.sqrt(energy / audio.length).toFixed(8)),
      clippedSamples,
      phonemeLengths,
    };
    report.clips.push(clip);
    console.log(JSON.stringify({ file: clip.file, seconds: clip.seconds, generationMs, peak: clip.peak, clippedSamples, phonemeLengths }));
  }
  report.validation.allowedFetchSchemes = [...new Set(requests)];
  await writeFile(join(output, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Three actual Nabra WAVs written. No external fetch, model upload, automatic diacritizer or Nova Voice change.');
} finally {
  if (tts) await tts.dispose();
  URL.revokeObjectURL(modelUrl);
  URL.revokeObjectURL(voiceUrl);
  globalThis.fetch = originalFetch;
}
