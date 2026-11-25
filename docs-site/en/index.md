---
layout: home

hero:
  name: "PVSSPW"
  text: "WebAssembly PS Vita Emulator Workbench & Benchmark Suite"
  tagline: "Patched Vitaslop with adaptive SMP sizing, zero-copy shared GPUDevice FSR 1 / FrameFlow (GameFI + GameSR 2x), and reproducible Vita3K Web benchmarks."
  actions:
    - theme: brand
      text: "Getting Started"
      link: /en/docs/
    - theme: alt
      text: "API & Probe Specs"
      link: /en/api-reference/
    - theme: alt
      text: "Architecture & Source"
      link: /en/docs/architecture

features:
  - title: "Incremental Patches & Adaptive SMP"
    details: "Applies four audited source patches onto pinned Vitaslop (MIT), isolates libsas.suprx as a SHA-256 overlay, and benchmarks optimal worker pools per session."
  - title: "Zero-Copy Post-Processing Ring"
    details: "Intercepts the guest swapchain into a 3-slot same-device GPUTexture ring for FrameFlow GameFI (2x/3x) and GameSR 2x, plus native WGSL FSR 1."
  - title: "COOP/COEP Harness & Pixel Probes"
    details: "Loopback multi-origin preview server, Worker-level WebGPU adapter probing, confirmed ZIP save validation, and SHA-256-locked benchmark reporting."
---

::: info Delivered Capabilities
- Ships a pure-browser workbench shell (`web/`) with `pvsspw-library` Web Locks concurrency safety, ZIP/VPK ingestion, rePatch management, and verified save ZIP export/restore.
- Supports hardware WebGPU `shader-f16` acceleration with zero-copy `GameFI` (`2x`/`3x`), `GameSR` (`2x`), and native two-pass `FSR 1` scaling.
:::

::: warning Explicit Non-Goals & Hard Boundaries
- **Zero game ROMs, Vita firmware, or PSN keys**: Test ZIPs and extracted overlays stay strictly local and gitignored.
- **No cloud accounts or remote admin routes**: The local server only listens on loopback and strictly validates `same-origin` headers on `/__local/open-edge`.
- **Hardware gating for AI post-processing**: Software adapters disable `GameFI`/`GameSR` automatically and present via `canvas` 2D fallback (`uiPresent=software`).
:::

## Quick Verification

```sh
# 1. Pure-JS unit tests (thread policy, adapter selection, GPU submit probes)
node --test tests/*.test.mjs

# 2. Restore 93 hash-locked player baseline files offline
python3 scripts/prepare.py players

# 3. Serve the patched Vitaslop workbench with COOP/COEP headers (127.0.0.1:18747)
python3 scripts/serve.py vitaslop --fixed --port 18747
```
