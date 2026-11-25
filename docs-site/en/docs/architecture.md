# Architecture & Source Guide

PVSSPW cleanly separates four runtime boundaries across the repository:

1. **Workbench Shell (`web/`)**: Manages tabs, `pvsspw-library` Web Locks, JSPI/OPFS/WebGPU readiness (`web/platform.js`, `web/graphics.js`), adaptive SMP (`web/thread-policy.js`), Worker interception (`web/engine.js`), and zero-copy FrameFlow orchestration (`web/frameflow-worker.js`).
2. **Patched Upstream Core (`patches/`)**: Maintains clean diff stacks over MIT-licensed Vitaslop (`firmware`, `playback`, `battle`, `fsr1`) compiled to single- and multi-threaded Wasm via `scripts/build_vitaslop.py`.
3. **Loopback Server & Runners (`scripts/`, `bench/`)**: Enforces COOP/COEP headers, hash-verified sample prep, same-origin launcher validation, and non-intrusive GPU submit / pixel-diff probes.
4. **Evidence & Unit Checks (`tests/`, `results/`)**: Fast pure-JS unit tests (`node --test tests/*.test.mjs`) alongside archived benchmark JSONs verified by `scripts/report.py`.

Continue to [End-to-End Walkthrough](/en/docs/walkthrough) or [Code Map by Responsibility](/en/docs/code-map).
