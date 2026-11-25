# FSR 1, FrameFlow Zero-Copy Ring & Benchmark Protocol

## Zero-Copy WebGPU Post-Processing (`web/frameflow-worker.js`, `patches/vitaslop-fsr1.patch`)

- **Opt-in `shader-f16`**: Loaded before `worker-probe.js` and `worker.js`, wrapping `GPUAdapter.prototype.requestDevice` to append `'shader-f16'` cleanly on hardware GPUs.
- **3-Slot Ring (`ensureRingAndSession`)**: Redirects swapchain targets into `frameflow-ring-0..2` (`tex.destroy = () => {}`) on the shared `GPUDevice`, running `GameFI` (`lite-2x`/`std-2x`/`lite-3x`/`std-3x`) prior to optional `GameSR` (`sr-lite`/`sr-std`).
- **Mutual Exclusion & Software Guard**: `web/engine.js` suppresses native `fsr1` (`!srActive`) while `GameSR` is active, and `uiPresent=software` forces all AI presets off.

## Benchmark & Integrity Protocol (`bench/`, `scripts/report.py`)

- **First Frame & Submit Probe (`bench/worker-probe.js`)**: Emits `pvsspw-submit` strictly when a command buffer writes to a newly acquired visible swapchain texture, ignoring shader warmup or offscreen passes.
- **600s Sustained Battle & `PV_FSR_COMPARE=1`**: Verifies jump + landing at battle spawn before counting whole-screen and central-region pixel diffs (`battle.mjs` / `fsr-comparison.mjs`).
- **Hash-Verified Reports**: `scripts/report.py` validates SHA-256 digests on every cited JSON trial and image before updating `results/COMPARISON.md`.
