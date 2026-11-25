# FSR 1 & FrameFlow Same-Device Zero-Copy Pipeline

PVSSPW integrates two WebGPU post-processing systems over the native emulator texture without CPU readback:

## Native Two-Pass FSR 1 (`vitaslop-fsr1.patch`)

Executed at the tail of `vitaslop-web` display rendering when upscaling to display resolution (`outputResolution = display`, `fsr1 = on`):
- `fsr1-easu` samples the native stage texture into a dynamically resized `Rgba8Unorm` `fsr1-scratch` image.
- `fsr1-rcas` sharpens into the swapchain surface target without altering internal guest render target resolution.

## Shared-`GPUDevice` Zero-Copy Ring (`web/frameflow-worker.js`)

Loaded as the outermost module before `worker-probe.js` and `worker.js`:
1. **Opt-in `shader-f16`**: Wraps `GPUAdapter.prototype.requestDevice` on hardware GPUs to append `'shader-f16'` when exposed, cleanly falling back if the driver declines.
2. **3-Slot Ring Interception (`ensureRingAndSession`)**: Redirects swapchain acquisitions into `frameflow-ring-0..2` (`tex.destroy = () => {}`) on the shared `GPUDevice` so `GameFI` (`lite-2x`, `std-2x`, `lite-3x`, `std-3x`) and `GameSR` (`sr-lite`, `sr-std`) execute directly on GPU textures.
3. **Mutual Exclusion & Software Guard**: `web/engine.js` disables native `fsr1` whenever `srActive` (`GameSR`) is enabled, and `uiPresent=software` disables `uiFrameflow` and `uiSr` completely.
