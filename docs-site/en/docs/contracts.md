# Vitaslop Patch Stack, Adaptive SMP & Workbench Contracts

## Incremental 4-Patch Stack (`scripts/build_vitaslop.py`)

`apply_stack()` validates clean commit tree prefixes in an isolated `GIT_INDEX_FILE` before applying:
1. `vitaslop-firmware.patch`: Relocation & decoder fixes plus initial `libkernel` and `texenc` helpers.
2. `vitaslop-playback.patch`: Input key polling (`InputState`), `avplayer` / `iofilemgr` pacing, and overridable knobs.
3. `vitaslop-battle.patch`: ARM jump-table decoding (`lower.rs`) and fiber/kernel-thread wakeup handling (`state_threads.rs`).
4. `vitaslop-fsr1.patch`: Two-pass WGSL `Fsr1` (`fsr1-easu` -> `fsr1-rcas`) over the display texture.

## Adaptive SMP Selection (`web/thread-policy.js`)

`chooseThreadPolicy()` locks the guest thread count once before booting the scheduler:
1. `VITASLOP_SMP === '0'` -> `{ mode: 'single' }`.
2. Valid `VITASLOP_SMP_WORKERS` (`1..8`) -> `{ mode: 'manual', workers }`.
3. Measured hardware override (`PCSG00214` + `Linux x86_64` + `Edg/157.` + `24`-core/`32 GiB` + Intel `xe-lpg` `core`, non-software) -> `{ mode: 'game', workers: 3 }`.
4. Otherwise runs 1.2s bounded micro-benchmarks up to `guestWorkerLimit(cores, memoryGiB)` (reserving 2 host cores, clamped `2..6`) and selects `selectWorkerCount()` (smallest pool `>= 90%` of peak throughput), falling back to `budget` on timeout.
