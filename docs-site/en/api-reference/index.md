# Workbench Parameters, Backends & Probes Reference

Aligned directly with `web/engine.js`, `web/thread-policy.js`, `web/frameflow-worker.js`, `scripts/serve.py`, `scripts/edge_backends.py`, and `bench/worker-probe.js`.

## `/worker.js` Query Parameters (`web/engine.js`)

| Query Param | Values / Source | Purpose |
| --- | --- | --- |
| `uiGpu` | `high-performance` / `low-power` / empty | Adapter power preference passed to worker |
| `uiMode` | `core` / `compatibility` / `fallback` | WebGPU request feature level / fallback mode |
| `uiPresent` | `'software'` (only on software adapters) | Switches to 2D canvas software presentation and forces AI presets off |
| `uiFrameflow` | `off` / `lite-2x` / `std-2x` / `lite-3x` / `std-3x` | Enables FrameFlow `GameFI` optical-flow frame generation |
| `uiSr` | `off` / `sr-lite` / `sr-std` | Enables FrameFlow `GameSR` 2× scaling (suppresses native `fsr1`) |

## `window.vitaPlayer` & Worker Messages

- `start(title, selectedGraphics?)` / `stop()`: Resolves effective title settings + `chooseThreadPolicy()`, starts core, and updates hash to `#/play/<titleId>`.
- `setFrameflow(preset)` / `setGameSr(preset)`: Posts `{ type: 'pvsspw-frameflow', preset }` or `{ type: 'pvsspw-sr', preset }` live to the active core worker.
- `flush()`: Posts `{ type: 'flush-game-data' }` to flush OPFS save buffers.

## Same-Origin Loopback Launcher (`POST /__local/open-edge`)

Enabled only when `serve.py` runs with the local launcher flag; rejects (`403`/`400`) unless:
- `Host` is `127.0.0.1:<port>` or `localhost:<port>`, `Origin === http://<Host>`, `Sec-Fetch-Site === same-origin`, and `X-PVSSPW-Action === open-edge`.
- JSON payload is `<= 256` bytes and selects one of `BACKENDS`: `webgpu`, `vulkan`, `nvidia`, `opengl`, or `software`.

## Render Pass & GPU Probe Labels

- **GPU Submit Probe (`bench/worker-probe.js`)**: Emits `{ type: 'pvsspw-submit', time }` only when a submitted command buffer wrote into a distinct visible swapchain texture acquired via `getCurrentTexture()`.
- **Post-FX Labels**: Native passes use `present-scale`, `fsr1-easu`, `fsr1-rcas`, and `fsr1-scratch`; same-device ring slots are labeled `frameflow-ring-0..2`.
