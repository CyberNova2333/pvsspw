# End-to-End Execution Walkthrough

Launching a title in PVSSPW progresses through five gated stages:

1. **Exclusive Lock & Ingest (`web/shell.js`, `web/library.js`, `web/files.js`)**: `storageLock` acquires non-blocking `pvsspw-library` Web Lock before title install/rePatch; save restores validate ZIP schemas inside `/gamedata-worker.js` before user confirmation.
2. **Platform & Graphics Readiness (`web/platform.js`, `web/graphics.js`)**: `checkPlatform()` enforces `isSecureContext`, JSPI, `OffscreenCanvas`, and OPFS sync handles (`fatal` on failure), while `findGraphics()` probes `core` -> `compatibility` -> `fallback` adapters in a worker.
3. **SMP Pool & Worker Handoff (`web/thread-policy.js`, `web/engine.js`)**: `chooseThreadPolicy()` sets `VITASLOP_SMP_WORKERS`, and patched `window.Worker` injects `uiGpu`, `uiMode`, `uiPresent`, `uiFrameflow`, and `uiSr` into `/worker.js`.
4. **Zero-Copy Ring vs Software Fallback (`web/frameflow-worker.js`, `web/engine.js`)**: Hardware runs intercept swapchain textures into `frameflow-ring-0..2` and suppress `fsr1` when `GameSR` is active; software mode forces AI presets off and falls back to `pvsspw-software-frame` 2D canvas drawing.
5. **Submit Telemetry & Clean Teardown (`bench/worker-probe.js`, `web/engine.js`)**: Only distinct command buffers rendering to the visible canvas emit `pvsspw-submit`, and exit awaits worker termination (`OPFS` release) cleanly.

Verify unit rules with `node --test tests/*.test.mjs`, or inspect the [Code Map](/en/docs/code-map).
