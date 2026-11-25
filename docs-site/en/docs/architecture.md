# Architecture & Interactive Diagram

PVSSPW cleanly separates four runtime and tooling boundaries:

<DiagramFrame
  src="/diagrams/pvsspw-architecture.html"
  title="PVSSPW Browser Workbench, Patched Core & Shared-GPUDevice Post-FX Architecture"
  aspect="940 / 345"
  new-tab-label="Open Fullscreen ↗"
/>

## Four-Layer Responsibility Split

1. **Workbench Shell (`web/`)**: Enforces `pvsspw-library` Web Locks, JSPI/OPFS/WebGPU readiness (`web/platform.js`, `web/graphics.js`), adaptive SMP (`web/thread-policy.js`), Worker interception (`web/engine.js`), and zero-copy FrameFlow orchestration (`web/frameflow-worker.js`).
2. **Patched Upstream Core (`patches/`)**: Maintains clean diff stacks over MIT Vitaslop (`firmware`, `playback`, `battle`, `fsr1`) compiled to single- and multi-threaded Wasm via `scripts/build_vitaslop.py`.
3. **Loopback Server & Runners (`scripts/`, `bench/`)**: Enforces COOP/COEP headers, hash-verified sample prep, same-origin launcher validation, and non-intrusive GPU submit / pixel-diff probes.
4. **Tests & Verified Reports (`tests/`, `results/`)**: Fast pure-JS unit tests (`node --test tests/*.test.mjs`) alongside SHA-256-locked benchmark reports (`scripts/report.py`).

Continue to [End-to-End Walkthrough](/en/docs/walkthrough), [Code Map](/en/docs/code-map), or [Engineering Decisions](/en/docs/decisions).
