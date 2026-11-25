---
layout: home

hero:
  name: "PVSSPW"
  text: "PS Vita Web Workbench & Benchmark Suite"
  tagline: "Patches pinned Vitaslop (libsas overlay, ARM jump-table/wakeup fixes, SMP pooling) and pairs it with zero-copy FSR 1, FrameFlow GameFI / GameSR 2x, and reproducible Vita3K Web baselines."
  actions:
    - theme: brand
      text: "Getting Started"
      link: /en/docs/
    - theme: alt
      text: "API & Probes"
      link: /en/api-reference/
    - theme: alt
      text: "Patch & SMP Contracts"
      link: /en/docs/contracts
    - theme: alt
      text: "Architecture & Diagram"
      link: /en/docs/architecture

features:
  - title: "Audited Patch Stack & Adaptive SMP"
    details: "Applies four incremental patches onto pinned Vitaslop (MIT), isolates libsas.suprx via SHA-256 overlay, and picks optimal worker counts."
  - title: "Zero-Copy Post-FX Texture Ring"
    details: "Intercepts WebGPU swapchain draws on the shared GPUDevice for GameFI (2x/3x) interpolation & GameSR 2x SR, or native two-pass FSR 1."
  - title: "Lock-Protected Workbench & Saves"
    details: "Guards library mutations with pvsspw-library Web Locks and validates save ZIPs inside a dedicated worker before user-confirmed restore."
  - title: "Repeatable Pixel & Submit Probes"
    details: "Tracks visible canvas commits via worker-probe.js, measures 600s battle pixel updates, and SHA-256 checks all reported frames."
---

## Capabilities & Explicit Boundaries

::: info What PVSSPW Delivers
- Runs patched single- and multi-threaded Vitaslop Wasm behind a pure-browser workbench with ZIP/VPK/rePatch ingestion and verified save ZIP export/restore.
- Supports hardware WebGPU `shader-f16` acceleration across `GameFI` (`2x`/`3x`), `GameSR 2x`, and two-pass WGSL `FSR 1` — explore full switches and probes in [API & Probe Reference](/en/api-reference/).
:::

::: warning Explicit Non-Goals & Hard Limits
- **Zero game ROMs, Vita firmware dumps, or PSN keys**: Test ZIPs and extracted overlays remain strictly gitignored and hash-checked locally.
- **No cloud accounts or remote admin panels**: Loopback `serve.py` checks strict same-origin headers (`Host`, `Origin`, `Sec-Fetch-Site`, `X-PVSSPW-Action`).
- **Software rasterizers disable AI post-processing**: `uiPresent=software` forces `GameFI`/`GameSR` off and falls back to 2D canvas presentation without cross-extrapolating desktop FPS to phones.
:::

## Architecture Overview

<DiagramFrame
  src="/diagrams/pvsspw-architecture.html"
  title="PVSSPW Browser Workbench, Patched Core & Shared-GPUDevice Post-Processing Architecture"
  aspect="940 / 345"
  new-tab-label="Open Fullscreen ↗"
/>

## Quick Start

```sh
# 1. Run pure-JS unit tests (thread policy, adapter probing, submit probes)
node --test tests/*.test.mjs

# 2. Restore 93 hash-locked player snapshot files offline
python3 scripts/prepare.py players

# 3. Serve patched Vitaslop on isolated loopback with COOP/COEP (127.0.0.1:18747)
python3 scripts/serve.py vitaslop --fixed --port 18747
```

## Documentation Guide

::: tip Quick Navigation by Goal
- **Restore snapshots, rebuild Wasm & launch preview**: Start with [Setup, Rebuilding & Loopback Server](/en/docs/deployment) and [Runtime & Benchmark FAQ](/en/docs/troubleshooting);
- **Inspect core patches, SMP rules & post-FX**: Read [Patch Stack, SMP & Contracts](/en/docs/contracts) and [FSR 1, FrameFlow & Battle Benchmarks](/en/docs/performance);
- **Trace source ownership & ADRs**: Explore [Architecture & Interactive Diagram](/en/docs/architecture), [End-to-End Walkthrough](/en/docs/walkthrough), [Code Map](/en/docs/code-map), and [Engineering Decisions](/en/docs/decisions).
:::
