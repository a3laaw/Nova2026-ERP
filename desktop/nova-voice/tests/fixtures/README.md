# Synthetic Piper integration fixture

`test_voice.onnx` (1,602 bytes) and its config come from
[OHF-Voice/piper1-gpl v1.8.0](https://github.com/OHF-Voice/piper1-gpl/tree/v1.8.0/tests),
under GPL-3.0-or-later (see ../../LICENSE).

This is **not a trained speech voice**: it emits one second of silence per sentence.
It exercises the real ONNX/Piper/phonemization/audio-export pipeline without downloading
large models, cloud access, or including a licensed production voice in Git.

The upstream reproducible generator is
[generate_test_voice.py](https://github.com/OHF-Voice/piper1-gpl/blob/v1.8.0/tests/generate_test_voice.py).
Arabic tests reuse this synthetic graph with the Arabic eSpeak configuration and the
diacritizer bundled in Piper. They do not assess naturalness or intelligibility.

## Authored composition vectors

`graph-cases.json` contains owned valid/invalid declarative scene trees and pure
Bezier/keyframe/orthographic math vectors shared with the DOM tests. They are
synthetic validation evidence, not model replies, geographic data, biological
formation sequences or proof of semantic generalization. No code or URLs from
invalid vectors are executed. See `COMPOSITION-MOTION-AR.md` for the contract.
