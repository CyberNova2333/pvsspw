# Overview & Scope Boundaries

**PVSSPW** combines patched **Vitaslop** (`MIT`), a unified browser workbench (`web/`), hash-locked **Vita3K Web** comparison snapshots, and zero-copy post-processing (**FSR 1**, **GameFI**, **GameSR 2×**) behind reproducible Playwright/ADB benchmark tooling.

## Architecture Layers

| Layer | Path | Scope |
| --- | --- | --- |
| Browser Workbench | `web/` | Web Lock library guards, JSPI/OPFS/WebGPU checks, adaptive SMP selection, shared-device post-FX |
| Vitaslop Patch Stack | `patches/` | 4 incremental patches (`firmware`, `playback`, `battle`, `fsr1`) compiled outside git history |
| Tooling & Harness | `scripts/` | Snapshot extraction, Wasm patching, loopback COOP/COEP server, desktop/Android runners, report generation |
| Probes & Tests | `bench/`, `tests/` | Zero-overhead GPU submission hooks, lossless FSR pass triplets, pure-JS unit tests & workbench checks |

## Runtime Gates Before Launch

- **Fatal checks (`web/platform.js`)**: `isSecureContext`, WebAssembly, JSPI (`WebAssembly.Suspending`), `OffscreenCanvas`, and OPFS `createSyncAccessHandle` inside a dedicated probe worker.
- **Cross-origin isolation**: Loopback preview serves `COOP` / `COEP` headers enabling multi-threaded Wasm (`pthreads`) and `SharedArrayBuffer`.
- **Adapter discovery (`web/graphics.js`)**: Dedicated worker probes `core` -> `compatibility` -> `fallback`, preferring hardware GPUs over software rasterizers.

Continue to [Setup, Rebuilding & Local Server](/en/docs/setup), [Benchmark Protocol](/en/docs/benchmarks), or [API & Probe Reference](/en/api-reference/).
