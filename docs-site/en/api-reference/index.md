---
layout: page
sidebar: false
title: API & Probe Reference
description: Reference for PVSSPW preflight gates, ZIP save validation, chooseThreadPolicy SMP sizing, shared-GPUDevice frameflow-worker ring, serve.py, and GPU submit probes.
---

<script setup lang="ts">
import { apiSpecEn } from '../../.vitepress/data/api-spec'
</script>

<ApiExplorer :spec="apiSpecEn">

### Platform & Adapter Preflight (`checkPlatform` / `findGraphics`) {#platform-and-graphics}

Enforces Secure Context, JSPI, OffscreenCanvas, and OPFS sync handles (`fatal` if missing) while preferring hardware WebGPU adapters inside a dedicated worker.

### Save ZIP Export & Verification (`exportSaves` / `restoreSaves`) {#save-zip-validation}

Exports per-title or full saves and runs `/gamedata-worker.js` schema validation before user confirmation.

### Adaptive Guest SMP Policy (`chooseThreadPolicy`) {#thread-policy}

Combines user overrides, measured hardware presets (3 workers for `PCSG00214` on Linux Edge 157 Intel Xe-LPG), and 90%-peak parallel worker probing.

### Shared-`GPUDevice` Post-FX Ring & FSR 1 Exclusion (`frameflow-worker.js`) {#frameflow-worker-bridge}

Requests `shader-f16`, routes swapchains through `frameflow-ring-0..2` for `GameFI` / `GameSR`, disables AI in software mode, and suppresses native `fsr1` when `GameSR` runs.

### Loopback Server & GPU Submit Probes (`serve.py` / `worker-probe.js`) {#serve-and-probes}

Serves COOP/COEP isolation headers, guards `/__local/open-edge` with strict same-origin header checks, and emits `pvsspw-submit` only on visible canvas writes.

</ApiExplorer>
