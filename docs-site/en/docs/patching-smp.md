# Vitaslop Patch Stack & Adaptive SMP Policy

## Four-Stage Patch Stack (`scripts/build_vitaslop.py`)

`apply_stack` verifies clean git tree prefixes inside a temporary `GIT_INDEX_FILE` before applying:
1. `vitaslop-firmware.patch`: Reloc/decoder fixes and initial `libkernel` + texture encoding helpers for system module mounting.
2. `vitaslop-playback.patch`: Ctrl input sync, `avplayer` / `iofilemgr` pacing, and overridable knobs.
3. `vitaslop-battle.patch`: ARM jump-table recognition (`lower.rs`) and coroutine kernel-thread signal wakeup fixes (`state_threads.rs`).
4. `vitaslop-fsr1.patch`: Two-pass WGSL `Fsr1` (`fsr1-easu` -> `fsr1-rcas`) over the final display texture.

Additionally, `make_overlay()` extracts `libsas.suprx`, verifies its SHA-256 (`f6a626a7851d0e63b5c6de23f048f1ae4855dbcd46842193d35a29c3e63b4372`), and packs `vitaslop-sas.zip` separately so core binaries omit firmware dumps.

## Adaptive Guest Thread Pool (`web/thread-policy.js`)

`chooseThreadPolicy(knobs, device, options)` resolves concurrency before booting the core scheduler:
1. `VITASLOP_SMP === '0'` -> `{ mode: 'single' }`.
2. Valid `VITASLOP_SMP_WORKERS` in `1..8` -> `{ mode: 'manual', workers }`.
3. `guestWorkerLimit(cores, memoryGiB)` reserves 2 cores (`cores - 2`) and caps by RAM (`2 GiB -> 2`, `4 GiB -> 4`, higher -> `6`, clamped `>= 2`).
4. On the verified `PCSG00214` + `Linux x86_64` + `Edg/157.` + `24`-core/`32 GiB` + `intel`/`xe-lpg` (`core`, non-software) host, returns `{ mode: 'game', workers: 3 }` directly (measured faster than a 6-worker pool).
5. Otherwise benchmarks parallel workers up to `limit` (1.2 s timeout) via `selectWorkerCount()`, choosing the smallest worker count achieving `>= 90%` of peak throughput, falling back to `{ mode: 'budget', workers: limit }` if timing fails.
