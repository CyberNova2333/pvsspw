# Runtime & Benchmark FAQ

## 1. Workbench refuses launch with a `fatal` capability check

`web/platform.js` marks `isSecureContext`, WebAssembly, JSPI (`WebAssembly.Suspending`), `OffscreenCanvas`, and worker OPFS `createSyncAccessHandle` as fatal. Plain HTTP LAN URLs (outside `localhost`/`127.0.0.1`) cause browsers to withhold Secure Context APIs.

## 2. Why do `GameFI` / `GameSR` turn off, or why does `FSR 1` turn off when `GameSR` is active?

- **Software rasterizer guard**: If `findGraphics()` only resolves a software adapter (`SwiftShader` etc.), `uiPresent=software` disables `uiFrameflow` and `uiSr` completely.
- **FSR 1 exclusion**: `web/engine.js` sets `fsr1 = false` whenever `GameSR` is selected so dual upscalers never double-sharpen frames.

## 3. Save ZIP restore fails before writing OPFS

`restoreSaves()` (`web/files.js`) checks `[A-Za-z0-9_-]+.zip`, rejects duplicate names, and validates entry structure inside `/gamedata-worker.js` before prompting to overwrite.

## 4. `POST /__local/open-edge` rejects with `403`, `404`, or `400`

Enabled only with the local launcher switch on `serve.py`, requiring loopback `Host`, exact `Origin`, `Sec-Fetch-Site: same-origin`, `X-PVSSPW-Action: open-edge`, JSON body `<= 256` bytes, and a verified local browser + ICD backend (`scripts/edge_backends.py`).
