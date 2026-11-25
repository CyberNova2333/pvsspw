# Overview & Scope Boundaries

**PVSSPW** combines patched **Vitaslop** (`MIT`), a unified browser workbench (`web/`), hash-locked **Vita3K Web** comparison snapshots, and zero-copy post-processing (**FSR 1**, **GameFI**, **GameSR 2×**) behind repeatable Playwright/ADB benchmarks.

## Layer Responsibilities

| Layer | Path | Scope |
| --- | --- | --- |
| Browser Workbench | `web/` | Web Lock guards, JSPI/OPFS/WebGPU readiness, adaptive SMP sizing, shared-GPUDevice post-FX |
| Vitaslop Patch Stack | `patches/` | Four incremental patches (`firmware`, `playback`, `battle`, `fsr1`) compiled cleanly on checkout |
| Tooling & Harness | `scripts/` | Snapshot extraction, Wasm builds, loopback COOP/COEP server, desktop/Android runners, reporting |
| Probes, Tests & Reports | `bench/`, `tests/`, `results/` | Non-intrusive GPU submit hooks, lossless FSR pass captures, pure-JS unit checks, verified reports |

## Pre-Launch Runtime Gates

- **Fatal checks (`web/platform.js`)**: `isSecureContext`, WebAssembly, JSPI (`WebAssembly.Suspending`), `OffscreenCanvas`, and worker-verified OPFS `createSyncAccessHandle`.
- **Cross-origin isolation**: Loopback server enforces `COOP` / `COEP` headers enabling multi-threaded Wasm (`pthreads`) and `SharedArrayBuffer`.
- **Hardware GPU preference (`web/graphics.js`)**: Worker probes `core` -> `compatibility` -> `fallback` preferring hardware adapters over software rasterizers.

Continue to [Setup, Rebuilding & Loopback Server](/en/docs/deployment) or [API & Probe Reference](/en/api-reference/).
