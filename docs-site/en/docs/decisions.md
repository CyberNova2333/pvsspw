# Engineering Decisions & Benchmark ADRs

| Decision | Choice Kept | Rejected Alternative & Rationale | Source Anchor |
| --- | --- | --- | --- |
| Upstream modification | 4 incremental `.patch` files + `apply_stack()` | Avoids mixing full MIT upstream trees into AGPL first-party history | `patches/*.patch`, `scripts/build_vitaslop.py` |
| Firmware handling | Standalone SHA-256 verified `vitaslop-sas.zip` (`libsas.suprx`) | Keeps `os0/vs0/sa0` firmware dumps cleanly out of builds and repo | `scripts/build_vitaslop.py` |
| Intel Xe-LPG SMP rule | 3 guest workers on `PCSG00214` (Linux Edge 157 24c/32G); 90%-peak plateau elsewhere | 6-worker probe choice underperformed 3 workers due to contention | `web/thread-policy.js`, `tests/thread-policy.test.mjs` |
| Post-FX coordination | 3-slot same-device ring + suppress `fsr1` during `GameSR` | Prevents cross-device texture copies, blocking readbacks, and double upscaling | `web/frameflow-worker.js`, `web/engine.js` |
| Benchmark accounting | Isolated ports + visible-surface submit hook + SHA-256 report verification | Filters warmup/offscreen submits and locks screenshot provenance | `scripts/serve.py`, `bench/worker-probe.js`, `scripts/report.py` |
