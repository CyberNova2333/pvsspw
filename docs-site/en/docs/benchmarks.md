# Benchmark Protocol & Verification

All desktop/mobile runs adhere to repeatable fixture hashes (`bench/sample.lock.json`, `bench/players.lock.json`) and explicit separation between UI events and rendered frames:

1. **First Frame**: Timed from pressing Play until identifiable visual output appears (assisted by `bench/worker-probe.js` `pvsspw-submit` signals filtering non-present queue submits).
2. **600-Second Sustained Battle**: `scripts/battle.mjs` verifies controllable jump/landing in the first battle spawn before capturing GPU pixel-diff counts (`whole screen` vs `central region`) and queue submission counts for 600s.
3. **Same-Frame FSR 1 Comparison (`PV_FSR_COMPARE=1`)**: Captures lossless `native`, `off`, and `on` texture triples from the identical GPU pass sequence (`present-scale` vs `fsr1-easu` + `fsr1-rcas`), then toggles cleanly in-game.
4. **Save & Reload Integrity**: Exporting and restoring saves (`web/files.js`) validates archive schemas in a dedicated worker and confirms reloads reflect expected progress rather than inferring success from OPFS presence alone.
5. **SHA-256 Guarded Reporting**: Running `python3 scripts/report.py` checks every cited JSON run and reviewed screenshot SHA-256 before regenerating `results/COMPARISON.md`.
