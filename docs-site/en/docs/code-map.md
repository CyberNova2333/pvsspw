# Code Map by Responsibility

| Directory | Responsibility | Key Files | Role |
| --- | --- | --- | --- |
| `web/` | Browser shell, JSPI/OPFS checks, SMP policy, engine & AI bridge | `shell.js`, `engine.js`, `frameflow-worker.js` | User UI, worker lifecycle & WebGPU post-FX |
| `patches/` | 4 incremental patches over pinned MIT Vitaslop | `vitaslop-firmware.patch`, `vitaslop-fsr1.patch` | Builds single/SMP Wasm cores cleanly |
| `scripts/` | Baseline snapshot/input prep, Wasm build, server & test drivers | `build_vitaslop.py`, `serve.py`, `run.mjs`, `report.py` | Reproducible setup, loopback hosting & tables |
| `bench/` | Non-intrusive GPU submit & FSR pass probes | `worker-probe.js`, `fsr-passes.js`, `fsr-comparison.mjs` | Accurate timing & pixel-comparison hooks |
| `tests/` | Fast pure-JS unit tests + Edge workbench check | `thread-policy.test.mjs`, `workbench.mjs` | Offline policy checks & desktop verification |
| `results/` | Audited comparison runs & SHA-256 verified frames | `COMPARISON.md`, `cases.json` | Published experimental records |

See [`repo-docs/code-map.md`](https://github.com/CyberNova2333/pvsspw/blob/main/repo-docs/code-map.md) for the full Chinese per-directory symbol ledger.
